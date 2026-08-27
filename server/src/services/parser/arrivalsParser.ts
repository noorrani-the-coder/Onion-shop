import { ArrivalsBoardData, ArrivalProduct, MarketArrivals } from '../../../../shared/types';

/**
 * Turns the arrival message traders forward into the structured board data.
 *
 * This is the extraction layer, and it is deliberately deterministic: arrival
 * counts and vehicle counts are numbers people trade against, so they are read
 * with regexes that either match or don't, never inferred. Anything the parser
 * cannot place is reported in `warnings` rather than guessed at, and the caller
 * is free to correct the structured result before it is rendered.
 *
 * The shape it expects, tolerant of case, punctuation and blank lines:
 *
 *     APMC YESWANTHPUR BENGALURU - 22
 *     Date 21-08-2026
 *
 *     YESWANTHAPURA APMC YARD
 *     ONION   56,784 BAGS   178 VEHICLES
 *     POTATO  21,471 BAGS    95 VEHICLES
 *
 *     DASANAPURA SUB MARKET
 *     ONION    1,610 BAGS    04 VEHICLES
 *
 *     TOTAL VEHICLES 300+13=313
 */

export interface ArrivalsParseResult {
  data: ArrivalsBoardData;
  warnings: string[];
  /** Lines the parser could not classify, verbatim, for the caller to show. */
  unparsedLines: string[];
}

const DEFAULT_COMMITTEE = 'AGRICULTURAL PRODUCE MARKET COMMITTEE';
const DEFAULT_LOCATION = 'YESWANTHPUR BENGALURU - 22';

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const UNIT_WORDS = ['BAGS', 'BAG', 'QUINTALS', 'QUINTAL', 'KGS', 'KG', 'TONNES', 'TONS', 'BOXES', 'BOX', 'LOTS'];

/**
 * A product row: name, an arrival count, a unit, and a vehicle count.
 *
 * Written to require the unit word so that a stray "TOTAL VEHICLES 313" line
 * can never be mistaken for a product, and to keep both numbers exactly as
 * printed — "07" stays "07", "56,784" keeps its comma.
 */
const ROW_RE = new RegExp(
  String.raw`^\s*(?<name>[A-Za-z][A-Za-z .&/()-]*?)\s*[:\-|]?\s*` +
    String.raw`(?<arrival>\d[\d,]*)\s*` +
    String.raw`(?<unit>${UNIT_WORDS.join('|')})\b\s*[:\-|]?\s*` +
    String.raw`(?<vehicles>\d[\d,]*)\s*(?:VEHICLES?|TRUCKS?|LOADS?)?\s*$`,
  'i'
);

const DATE_RE = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/;
const TOTAL_RE = /TOTAL\s+(?:VEHICLES?|TRUCKS?)\D*(?<expression>[\d+\s=,]+)$/i;

function toNumber(text: string): number | null {
  const n = Number(text.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pad2(n: string): string {
  const digits = n.replace(/,/g, '');
  return digits.length === 1 ? `0${digits}` : n;
}

/** "21-08-2026" plus the ISO form, from any of 21.08.26 / 21-8-2026 / 21/08/2026. */
function parseDate(line: string): { display: string; iso: string | null } | null {
  const m = DATE_RE.exec(line);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const yearRaw = Number(m[3]);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const display = `${dd}-${mm}-${year}`;

  // Date.UTC keeps the ISO day from drifting under the host's timezone.
  const stamp = new Date(Date.UTC(year, month - 1, day));
  const iso = Number.isNaN(stamp.getTime()) ? null : stamp.toISOString().slice(0, 10);
  return { display, iso };
}

function weekdayFor(iso: string | null, line: string): string | null {
  const stated = WEEKDAYS.find(d => line.toUpperCase().includes(d));
  if (stated) return stated;
  if (!iso) return null;
  const stamp = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(stamp.getTime()) ? null : WEEKDAYS[stamp.getUTCDay()];
}

/**
 * A market heading is a line with no digits that is not one of the report's own
 * banner lines — "YESWANTHAPURA APMC YARD", "DASANAPURA SUB MARKET".
 */
function looksLikeMarketHeading(line: string): boolean {
  if (/\d/.test(line)) return false;
  const upper = line.toUpperCase();
  if (upper.includes('ARRIVAL') && upper.split(/\s+/).length <= 3) return false;
  if (upper.startsWith('APMC WISE')) return false;
  if (upper.includes('MARKET COMMITTEE')) return false;
  if (upper.includes('MARKET REPORT')) return false;
  return line.trim().length >= 4;
}

export function parseArrivalsMessage(message: string): ArrivalsParseResult {
  const warnings: string[] = [];
  const unparsedLines: string[] = [];
  const lines = message.split(/\r?\n/);

  let committeeName = DEFAULT_COMMITTEE;
  let location = DEFAULT_LOCATION;
  let reportDateDisplay: string | null = null;
  let reportDate: string | null = null;
  let weekday: string | null = null;
  let totalVehicles: { total: number; parts: number[] } | null = null;

  const markets: MarketArrivals[] = [];
  let current: MarketArrivals | null = null;
  let sawCommitteeLine = false;
  let expectLocation = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const upper = line.toUpperCase();

    if (!sawCommitteeLine && (upper.includes('MARKET COMMITTEE') || upper.startsWith('APMC '))) {
      if (upper.includes('MARKET COMMITTEE')) {
        committeeName = line;
        // The committee's own address follows it on the board, so the next
        // line is claimed as the location unless it turns out to be data.
        expectLocation = true;
      } else {
        location = line.replace(/^APMC\s+/i, '').trim() || location;
      }
      sawCommitteeLine = true;
      continue;
    }

    if (expectLocation) {
      expectLocation = false;
      // Only a line that is plainly a place name — not a date, not a row.
      if (!ROW_RE.test(line) && !TOTAL_RE.test(line) && !/DATE/i.test(line)) {
        location = line;
        continue;
      }
    }

    const total = TOTAL_RE.exec(line);
    if (total?.groups) {
      // "300+13=313" — the stated sum wins; the parts are what the market shows.
      const numbers = (total.groups.expression.match(/\d+/g) || []).map(Number);
      if (numbers.length > 0) {
        const stated = /=/.test(total.groups.expression) ? numbers[numbers.length - 1] : numbers[0];
        const parts = /=/.test(total.groups.expression) ? numbers.slice(0, -1) : [];
        totalVehicles = { total: stated, parts };
      }
      continue;
    }

    const row = ROW_RE.exec(line);
    if (row?.groups) {
      if (!current) {
        // Rows before any heading still belong somewhere.
        current = { name: 'MARKET ARRIVALS', products: [] };
        markets.push(current);
        warnings.push('Arrival rows appeared before any market name; grouped them under "MARKET ARRIVALS".');
      }
      const product: ArrivalProduct = {
        name: row.groups.name.trim(),
        arrival: row.groups.arrival,
        arrivalValue: toNumber(row.groups.arrival),
        unit: row.groups.unit.toUpperCase(),
        vehicles: pad2(row.groups.vehicles),
        vehicleValue: toNumber(row.groups.vehicles),
      };
      current.products.push(product);
      continue;
    }

    if (/DATE/i.test(line) || DATE_RE.test(line)) {
      const parsed = parseDate(line);
      if (parsed && !reportDateDisplay) {
        reportDateDisplay = parsed.display;
        reportDate = parsed.iso;
        weekday = weekdayFor(parsed.iso, line);
        continue;
      }
    }

    if (looksLikeMarketHeading(line)) {
      current = { name: line, products: [] };
      markets.push(current);
      continue;
    }

    unparsedLines.push(line);
  }

  const populated = markets.filter(m => m.products.length > 0);
  if (populated.length !== markets.length) {
    warnings.push('Dropped a market heading that had no arrival rows under it.');
  }
  if (populated.length === 0) {
    warnings.push('No arrival rows were found. Expected lines like "ONION 56,784 BAGS 178 VEHICLES".');
  }
  if (!reportDateDisplay) {
    warnings.push('No date was found in the message.');
  }

  return {
    data: {
      committeeName,
      location,
      reportDate,
      reportDateDisplay,
      weekday,
      markets: populated,
      totalVehicles,
    },
    warnings,
    unparsedLines,
  };
}
