import { ArrivalsBoardData, ArrivalProduct } from '../../../../../shared/types';
import { warmTextMetrics, widthOf, fitSize, wrapToWidth } from '../textMetrics';

/**
 * Layout pass for the arrivals board.
 *
 * Nothing here draws: it measures the data, decides every font size, column
 * width and y offset, and reports how tall the canvas has to be to hold the
 * result. The renderer then only positions what this file already sized.
 *
 * The rule the whole file is built around: **text size is an input, not an
 * output.** Sizes come from the constants below and are never scaled down to
 * make content fit a fixed canvas — when there is more data, `canvasH` grows.
 * The only shrinking allowed is the narrow, bounded kind in `fitColumnSizes`,
 * where an unusually wide number would otherwise collide with its neighbour,
 * and even that stops at a floor that is still larger than the type on the
 * rate poster.
 */

export const CANVAS_W = 1080;
export const MARGIN = 32;
export const CONTENT_W = CANVAS_W - MARGIN * 2;

// The same display face as the rate poster, so both read as one shop. Anton
// is condensed and sits noticeably narrower beside it.
export const FONT_DISPLAY = "'Montserrat', 'Arial Black', Impact, sans-serif";
export const FONT_BODY = "'Roboto Condensed', 'Segoe UI', Arial, sans-serif";
export const DISPLAY_WEIGHT = 800;
export const BODY_WEIGHT = 700;

/**
 * The type scale, in the order of the board's visual hierarchy: arrival numbers
 * dominate, then product names, then vehicle counts, then market names, then
 * everything else. The `*Min` entries are floors for the bounded fitting in
 * `fitColumnSizes` — they are not "small" sizes, just less enormous ones.
 */
export const SIZE = {
  committee: 58,
  committeeMin: 32,
  location: 44,
  dateLabel: 40,
  date: 60,
  weekday: 38,
  marketName: 60,
  marketNameMin: 40,
  productName: 62,
  productNameMin: 44,
  arrival: 88,
  arrivalMin: 62,
  unit: 34,
  vehicles: 74,
  vehiclesMin: 55,
  vehiclesLabel: 26,
  totalLabel: 56,
  totalNumber: 126,
  totalParts: 34,
} as const;

/**
 * The board is built to 9:16, the same frame as the rate poster, so both
 * outputs look like they came from the same shop and fill a phone screen.
 *
 * Row height is therefore an output rather than a constant: the rows share
 * whatever is left after the fixed blocks, so four products give tall rows and
 * twelve give compact ones, and the board stays one screen either way. Only
 * when rows would fall under ROW_H_MIN — where a five-digit count stops being
 * readable at arm's length — does the canvas grow past 9:16 instead.
 */
export const CANVAS_H_TARGET = 1920;
export const ROW_H_MIN = 96;
export const ROW_H_MAX = 240;
/** The height the type scale was drawn against; sizes scale from this. */
const ROW_H_DESIGN = 190;

export const HEADER_H = 186;
export const DATE_BAR_H = 108;
export const MARKET_HEADER_H = 84;
export const TOTAL_BLOCK_H = 150;
export const BRANDING_H = 380;
export const SECTION_GAP = 16;
export const BORDER = 4;

// Column geometry inside a row.
export const VISUAL_W = 140;
export const TRUCK_W = 88;
export const COL_PAD = 12;
const MIN_UNIT_W = 104;
const MIN_NAME_W = 190;
// Absolute floor for the vehicle count, used only when the alternative is an
// undersized product name. Still larger than any number on the rate poster.
const VEHICLES_HARD_MIN = 48;

export interface RowPlan {
  product: ArrivalProduct;
  y: number;
  h: number;
  /** One entry per rendered line of the product name. */
  nameLines: string[];
  nameSize: number;
}

export interface MarketPlan {
  name: string;
  nameSize: number;
  y: number;
  h: number;
  headerH: number;
  rows: RowPlan[];
}

export interface ColumnPlan {
  visualX: number;
  nameX: number;
  nameW: number;
  arrivalX: number;
  arrivalW: number;
  unitX: number;
  unitW: number;
  vehicleX: number;
  vehicleW: number;
  arrivalSize: number;
  vehicleSize: number;
  unitSize: number;
  vehLabelSize: number;
}

export interface TotalPlan {
  y: number;
  h: number;
  total: number;
  parts: number[];
}

export interface BoardPlan {
  canvasW: number;
  canvasH: number;
  /** Where the shop branding band sits, below everything else. */
  brandingY: number;
  committeeSize: number;
  headerY: number;
  dateBarY: number;
  markets: MarketPlan[];
  columns: ColumnPlan;
  total: TotalPlan;
}

function allProducts(data: ArrivalsBoardData): ArrivalProduct[] {
  return data.markets.flatMap(m => m.products);
}

/**
 * Widest rendering of `texts` at `size`, so a column can be sized to its worst
 * case and every row of the board can then share one grid.
 */
function widest(texts: string[], family: string, weight: number, size: number): number {
  return texts.reduce((max, t) => Math.max(max, widthOf(t, family, weight, size)), 0);
}

/**
 * Chooses the arrival and vehicle font sizes, and from them every column width.
 *
 * The row is a fixed width, so the columns are a budget: what one takes another
 * gives up. They give up in the order of the board's hierarchy, which is the
 * whole point of doing this here rather than per row —
 *
 *   1. the vehicle count yields first, down to its floor,
 *   2. then the arrival count, down to its floor,
 *   3. and only then does the product name absorb what is left, shrinking
 *      within its own floor and wrapping to a second line past that.
 *
 * so the biggest number on the board is the last thing to give way. A board of
 * ordinary four- and five-digit arrivals never enters the loops at all.
 *
 * The name column is whatever the others leave, never a number this function
 * wishes for: claiming a width the row does not have is how a label ends up
 * printed underneath the pill beside it.
 */
/** Type sizes are drawn against ROW_H_DESIGN and scale with the actual row. */
function scaled(size: number, rowH: number, floor: number): number {
  return Math.max(floor, Math.round(size * (rowH / ROW_H_DESIGN)));
}

function fitColumnSizes(products: ArrivalProduct[], rowH: number): ColumnPlan {
  const arrivals = products.map(p => p.arrival);
  const units = products.map(p => p.unit.toUpperCase());
  const vehicles = products.map(p => p.vehicles);

  let arrivalSize = scaled(SIZE.arrival, rowH, 34);
  const arrivalFloor = scaled(SIZE.arrivalMin, rowH, 28);
  let vehicleSize = scaled(SIZE.vehicles, rowH, 26);
  const vehicleFloor = scaled(SIZE.vehiclesMin, rowH, 22);
  const vehicleHardFloor = scaled(VEHICLES_HARD_MIN, rowH, 20);
  const unitSize = scaled(SIZE.unit, rowH, 16);
  const vehLabelSize = scaled(SIZE.vehiclesLabel, rowH, 12);
  const nameFloor = scaled(SIZE.productNameMin, rowH, 22);

  // How narrow the name column may get is a property of the data, not a
  // constant: a name wraps between words but never inside one, so the widest
  // single word at the smallest allowed name size is the width below which
  // some row would have to be clipped. Capped, so one freak product name
  // cannot starve the numbers it sits beside.
  const longestWord = products
    .flatMap(p => p.name.toUpperCase().split(/\s+/))
    .reduce((max, word) => Math.max(max, widthOf(word, FONT_DISPLAY, DISPLAY_WEIGHT, nameFloor)), 0);
  const minNameW = Math.min(Math.max(MIN_NAME_W, longestWord + COL_PAD * 2), CONTENT_W * 0.42);

  const unitW = Math.max(widest(units, FONT_BODY, BODY_WEIGHT, unitSize) + COL_PAD * 2, MIN_UNIT_W);
  const vehLabelW = widthOf('VEHICLES', FONT_BODY, BODY_WEIGHT, vehLabelSize);

  const arrivalWidthAt = (size: number) => widest(arrivals, FONT_DISPLAY, DISPLAY_WEIGHT, size) + COL_PAD * 2;
  const vehicleWidthAt = (size: number) =>
    TRUCK_W + 10 + Math.max(widest(vehicles, FONT_DISPLAY, DISPLAY_WEIGHT, size), vehLabelW) + COL_PAD * 2;
  const nameWidthWith = (aSize: number, vSize: number) =>
    CONTENT_W - VISUAL_W - arrivalWidthAt(aSize) - unitW - vehicleWidthAt(vSize);

  // Clamped, not just decremented: a 2px step from 56 would otherwise land on
  // 54 and quietly break the floor it was meant to respect.
  while (nameWidthWith(arrivalSize, vehicleSize) < minNameW && vehicleSize > vehicleFloor) {
    vehicleSize = Math.max(vehicleFloor, vehicleSize - 2);
  }
  while (nameWidthWith(arrivalSize, vehicleSize) < minNameW && arrivalSize > arrivalFloor) {
    arrivalSize = Math.max(arrivalFloor, arrivalSize - 2);
  }
  // Last resort, and the reason it exists: a long single-word product name
  // ("BEETROOT", "CUCUMBER") can still leave the name column under its own
  // floor once both numbers are at theirs. The product name outranks the
  // vehicle count in the hierarchy, so the vehicle count is what gives — below
  // its preferred floor, never below legibility.
  while (nameWidthWith(arrivalSize, vehicleSize) < minNameW && vehicleSize > vehicleHardFloor) {
    vehicleSize = Math.max(vehicleHardFloor, vehicleSize - 2);
  }

  const arrivalW = arrivalWidthAt(arrivalSize);
  const vehicleW = vehicleWidthAt(vehicleSize);
  // Whatever is genuinely left. Floored only so a pathological board still
  // produces a drawable grid rather than negative geometry.
  const nameW = Math.max(80, CONTENT_W - VISUAL_W - arrivalW - unitW - vehicleW);

  const visualX = MARGIN;
  const nameX = visualX + VISUAL_W;
  const arrivalX = nameX + nameW;
  const unitX = arrivalX + arrivalW;
  const vehicleX = unitX + unitW;

  return {
    visualX,
    nameX,
    nameW,
    arrivalX,
    arrivalW,
    unitX,
    unitW,
    vehicleX,
    vehicleW,
    arrivalSize,
    vehicleSize,
    unitSize,
    vehLabelSize,
  };
}

/**
 * Every string the board will draw, so `warmTextMetrics` can measure them in one
 * batch before any synchronous sizing happens. A string missed here still
 * renders — it just falls back to a deliberately wide estimate.
 */
function stringsToMeasure(data: ArrivalsBoardData): { text: string; family: string; weight: number }[] {
  const products = allProducts(data);
  const display = (text: string) => ({ text, family: FONT_DISPLAY, weight: DISPLAY_WEIGHT });
  const body = (text: string) => ({ text, family: FONT_BODY, weight: BODY_WEIGHT });

  return [
    display(data.committeeName.toUpperCase()),
    display(data.location.toUpperCase()),
    display(data.reportDateDisplay || ''),
    body('DATE'),
    body(`${data.weekday || ''} ARRIVALS`),
    body('VEHICLES'),
    display('TOTAL VEHICLES'),
    ...data.markets.map(m => display(m.name.toUpperCase())),
    ...products.map(p => display(p.name.toUpperCase())),
    ...products.map(p => display(p.arrival)),
    ...products.map(p => display(p.vehicles)),
    ...products.map(p => body(p.unit.toUpperCase())),
  ].filter(e => e.text.length > 0);
}

/** Sums the board's vehicles, per market and overall. */
function vehicleTotals(data: ArrivalsBoardData): { total: number; parts: number[] } {
  const parts = data.markets.map(m => m.products.reduce((sum, p) => sum + (p.vehicleValue ?? 0), 0));
  return { total: parts.reduce((sum, n) => sum + n, 0), parts };
}

/**
 * Measures `data` and returns every dimension the renderer needs.
 *
 * Height is an output, never a constraint: it is the sum of what the content
 * asked for, so more rows make a taller board rather than smaller type.
 */
export async function planBoard(data: ArrivalsBoardData): Promise<BoardPlan> {
  await warmTextMetrics(stringsToMeasure(data));

  /**
   * Decide the row height before anything is positioned.
   *
   * Everything except the rows is a fixed block, so what the rows may have is
   * simply what those leave inside a 9:16 frame — divided by however many
   * products the report happens to carry. Clamped at both ends: tall enough
   * that a five-digit count stays readable, and capped so a two-row report
   * does not turn into two enormous bands.
   */
  const rowCount = data.markets.reduce((n, m) => n + m.products.length, 0);
  const fixedH =
    HEADER_H +
    DATE_BAR_H +
    SECTION_GAP +
    data.markets.length * (MARKET_HEADER_H + SECTION_GAP) +
    TOTAL_BLOCK_H +
    SECTION_GAP +
    BRANDING_H +
    MARGIN * 2;
  const rowSpace = CANVAS_H_TARGET - fixedH;
  const rowH = Math.max(ROW_H_MIN, Math.min(ROW_H_MAX, Math.floor(rowSpace / Math.max(rowCount, 1))));

  const columns = fitColumnSizes(allProducts(data), rowH);
  const committeeSize = fitSize(
    data.committeeName.toUpperCase(),
    FONT_DISPLAY,
    DISPLAY_WEIGHT,
    SIZE.committee,
    SIZE.committeeMin,
    CONTENT_W - 40
  );

  /**
   * The shop comes first, the committee's figures after.
   *
   * Whoever receives this should see who sent it before they read what it
   * says — the board is the shop's daily message, not a reprint of the
   * committee's notice.
   */
  let y = 0;
  const brandingY = y;
  y += BRANDING_H + SECTION_GAP;
  const headerY = y;
  y += HEADER_H;
  const dateBarY = y;
  y += DATE_BAR_H + SECTION_GAP;

  const markets: MarketPlan[] = data.markets.map(market => {
    const marketY = y;
    const nameSize = fitSize(
      market.name.toUpperCase(),
      FONT_DISPLAY,
      DISPLAY_WEIGHT,
      SIZE.marketName,
      SIZE.marketNameMin,
      CONTENT_W - 48
    );
    let rowY = marketY + MARKET_HEADER_H;

    const rows: RowPlan[] = market.products.map(product => {
      const name = product.name.toUpperCase();
      const avail = columns.nameW - COL_PAD * 2;

      const nameBase = scaled(SIZE.productName, rowH, 24);
      const nameMin = scaled(SIZE.productNameMin, rowH, 22);
      let nameSize = fitSize(name, FONT_DISPLAY, DISPLAY_WEIGHT, nameBase, nameMin, avail);
      // Too long for one line at that size? It wraps, and the row grows to hold
      // the second line rather than the name shrinking further.
      let nameLines = wrapToWidth(name, FONT_DISPLAY, DISPLAY_WEIGHT, nameSize, avail, 2);

      // `fitSize` returns its floor whether or not the floor actually fits, so
      // a name long enough to defeat the column sizing above would otherwise be
      // drawn straight through the pill beside it. This is the backstop: go
      // under the floor, but only as far as fitting requires. The column sizing
      // makes it near-unreachable; it exists so overflow is impossible rather
      // than merely unlikely.
      if (nameLines.some(line => widthOf(line, FONT_DISPLAY, DISPLAY_WEIGHT, nameSize) > avail)) {
        const longestWord = name.split(/\s+/).reduce((a, b) => (a.length >= b.length ? a : b), '');
        nameSize = fitSize(longestWord, FONT_DISPLAY, DISPLAY_WEIGHT, nameSize, 22, avail);
        nameLines = wrapToWidth(name, FONT_DISPLAY, DISPLAY_WEIGHT, nameSize, avail, 2);
      }

      const h = nameLines.length > 1 ? Math.round(rowH * 1.2) : rowH;
      const plan: RowPlan = { product, y: rowY, h, nameLines, nameSize };
      rowY += h;
      return plan;
    });

    const h = rowY - marketY;
    y = rowY + SECTION_GAP;
    return { name: market.name.toUpperCase(), nameSize, y: marketY, h, headerH: MARKET_HEADER_H, rows };
  });

  // A message that states its own total (and its own per-market split) always
  // wins over the sum of the rows: the market's own arithmetic is what traders
  // will check the board against.
  const stated = data.totalVehicles;
  const summed = vehicleTotals(data);
  const total: TotalPlan = {
    y,
    h: TOTAL_BLOCK_H,
    total: stated?.total ?? summed.total,
    parts: stated?.parts ?? summed.parts,
  };
  y += TOTAL_BLOCK_H + MARGIN;

  return {
    canvasW: CANVAS_W,
    // 9:16 unless the rows had to stay readable at a taller size.
    canvasH: Math.max(CANVAS_H_TARGET, Math.ceil(y)),
    brandingY,
    committeeSize,
    headerY,
    dateBarY,
    markets,
    columns,
    total,
  };
}
