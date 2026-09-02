import {
  ArrivalCount,
  CommodityItem,
  ConfidenceScores,
  MarketReportNormalized,
  NewOnionGrade,
  PriceRange,
  ReportSection
} from '../../../../shared/types';

/**
 * Utility to parse price string or pair of numbers into PriceRange
 * Supports: 4300-4500, 4300 – 4500, 4300/4500, 4300 to 4500, Rs. 4300-4500, ₹4300-4500, 3700, 4300 4500
 */
export function parsePriceRange(text: string | null | undefined): PriceRange | null {
  if (!text) return null;
  // Commas are stripped, not blanked: "4,200-4,500" must read as 4200-4500. A
  // comma turned into a space split the number and left the regex matching the
  // "200" fragment, quoting a rate the message never carried.
  const clean = text.replace(/(?<=\d),(?=\d)/g, '').replace(/[₹,\s*]|(?:Rs\.?|INR)/gi, ' ').trim();

  // Match range: e.g. 4300-4500, 4300/4500, 4000 to 4200, 4000 4200
  const rangeMatch = clean.match(/(\d{3,5})\s*(?:[-–—/]|to|\s)\s*(\d{3,5})/i);
  if (rangeMatch) {
    const num1 = parseInt(rangeMatch[1], 10);
    const num2 = parseInt(rangeMatch[2], 10);
    const min = Math.min(num1, num2);
    const max = Math.max(num1, num2);
    return {
      min,
      max,
      display: `${min}-${max}`
    };
  }

  // Match single rate e.g. 3700
  const singleMatch = clean.match(/(\d{3,5})/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1], 10);
    return {
      min: val,
      max: val,
      display: `${val}`
    };
  }

  return null;
}

/**
 * Lines that carry report metadata rather than a priced row. These are the only
 * words this function knows, and none of them is a section or grade name - they
 * are the fixed furniture of every message (its date, its arrivals line, its
 * sign-off), so recognising them costs nothing in flexibility.
 */
const META_LINE_RE =
  /^\s*(?:date\b|dt\b|apmc\s*wise|arrivals?\b|total\s+(?:vehicles?|trucks?|bags?)\b|sales?\b|weather\b|rates?\s+for\b|note[s:]?\b|thanks\b|regards\b|good\s+(?:morning|evening)\b)/i;

/** A label followed by a rate: "BIG. 4800-5000", "Medium Rs.4200-4800". */
const ROW_LINE_RE =
  /^\s*([A-Za-z][A-Za-z0-9 ()/.&'-]*?)\s*[:.\-|]*\s*(?:₹|Rs\.?|INR)?\s*((?:\d[\d,]*)\s*(?:[-–—/]|to)\s*(?:₹|Rs\.?|INR)?\s*(?:\d[\d,]*)|\d[\d,]*)\s*$/i;

/**
 * Reads the message as a sequence of titled sections, using shape alone.
 *
 * The rule is deliberately dumb, because a clever rule is one that has opinions
 * about vocabulary: a line that ends in a rate is a row, any other line with
 * letters in it opens a new section, and rows join whichever section is open.
 * Nothing here matches "Maharashtra", "Vijayapura" or any grade name, so a new
 * heading or a new grade needs no code change - and because a row can only ever
 * join the heading above it, one section's price can never surface under
 * another's title.
 */
export function parseSections(lines: string[]): ReportSection[] {
  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Bag/vehicle counts ("New onions 15,000+ bags") are part of a heading, not
    // a price, so they must never be read as a row.
    const isCount = /\b(?:bags?|vehicles?|trucks?|lorr(?:y|ies)|loads?|quintals?|kgs?|tonn?es?|boxes|lots?)\b/i.test(line);

    if (META_LINE_RE.test(line)) {
      // A sign-off closes whatever section was open; a stray "Sales ok" in the
      // middle should not swallow the rows that follow it.
      current = null;
      continue;
    }

    const rowMatch = !isCount ? line.match(ROW_LINE_RE) : null;
    if (rowMatch) {
      const label = rowMatch[1].replace(/[.\s]+$/, '').trim();
      const rate = parsePriceRange(rowMatch[2]);
      if (label && rate) {
        if (!current) {
          // Rows before any heading still belong somewhere.
          current = { title: 'RATES', rows: [] };
          sections.push(current);
        }
        current.rows.push({ label: label.toUpperCase(), rate });
        continue;
      }
    }

    // Anything else with letters in it is a heading. A date or a bare number
    // never reaches here, having been taken by META_LINE_RE or the row branch.
    if (/[A-Za-z]{3,}/.test(line)) {
      // A heading often carries its own arrival count ("New onions 15,000+
      // bags"). Split it off so the title reads as a title and the count can be
      // rendered as its own row.
      const countMatch = line.match(/([0-9][0-9,.]*\s*\+?)\s*(bags?|vehicles?|trucks?|lorr(?:y|ies)|loads?|quintals?|kgs?|tonn?es?|boxes|lots?)\b/i);
      const count = countMatch ? `${countMatch[1].replace(/\s+/g, '')} ${countMatch[2].toLowerCase()}` : null;
      const title = line
        .replace(countMatch ? countMatch[0] : '', ' ')
        .replace(/[:\-|]+\s*$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (title) {
        current = { title: title.toUpperCase(), count, rows: [] };
        sections.push(current);
      }
    }
  }

  // A heading with nothing under it is noise, not a section.
  return sections.filter(s => s.rows.length > 0);
}

/**
 * Parses date string in varied formats: 22.08.2026, 22/08/2026, 22-08-2026, 22/08/26, 22 Aug 2026
 */
export function parseDate(text: string): { isoDate: string | null; displayDate: string | null } {
  // Try DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY (also YY)
  const dmyMatch = text.match(/(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{2,4})/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);

    // Normalize 2-digit year to 20xx
    if (year < 100) year += 2000;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const isoDate = `${year}-${pad(month)}-${pad(day)}`;
      const displayDate = `${pad(day)}.${pad(month)}.${year}`;
      return { isoDate, displayDate };
    }
  }

  // Try text month e.g. 22 Aug 2026 or 22 August 2026
  const months: { [key: string]: number } = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12
  };

  const textMonthMatch = text.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})/i);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const mName = textMonthMatch[2].toLowerCase();
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) year += 2000;

    const monthNum = months[mName];
    if (monthNum && day >= 1 && day <= 31) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const isoDate = `${year}-${pad(monthNum)}-${pad(day)}`;
      const displayDate = `${pad(day)}.${pad(monthNum)}.${year}`;
      return { isoDate, displayDate };
    }
  }

  return { isoDate: null, displayDate: null };
}

/**
 * Parse arrivals count and truck count
 */
export function parseArrivalsAndTrucks(text: string): {
  arrivals: ArrivalCount | null;
  trucks: string | null;
} {
  let arrivals: ArrivalCount | null = null;
  let trucks: string | null = null;

  // Match truck counts: e.g. 325+ Trucks, 325 trucks, Truck 325+, Trucks - 325+
  const truckRegexes = [
    /(?:trucks?|lorry|lorries)\s*[:\-\s]*([0-9,]+(?:\s*\+)?)/i,
    /([0-9,]+(?:\s*\+)?)\s*(?:trucks?|lorry|lorries)/i,
    /TRUCK\s*([0-9,]+\+?)/i
  ];

  for (const regex of truckRegexes) {
    const match = text.match(regex);
    if (match) {
      trucks = match[1].replace(/\s+/g, '').trim();
      if (!trucks.toLowerCase().includes('truck') && !trucks.endsWith('+') && match[0].includes('+')) {
        trucks += '+';
      }
      break;
    }
  }

  // Match arrivals: 65,326 bags, 65326 bags, 65.326 bags, Arrival - 65,326 bags, ARRIVAL 65326
  const arrivalRegexes = [
    /(?:arrivals?|avakas?|inflow)\s*(?:wise)?\s*[:\-\s]*([0-9,.]+)\s*(?:bags?)?/i,
    /([0-9,.]+)\s*(?:bags?|katta|packets?)/i,
    /ARRIVAL\s*([0-9,.]+)/i
  ];

  for (const regex of arrivalRegexes) {
    const match = text.match(regex);
    if (match) {
      const numStr = match[1].replace(/[,\.]/g, '');
      const rawVal = parseInt(numStr, 10);
      if (!isNaN(rawVal) && rawVal > 100) { // filter small noise
        arrivals = {
          value: rawVal,
          display: `${rawVal.toLocaleString('en-IN')} bags`
        };
        break;
      }
    }
  }

  return { arrivals, trucks };
}

/**
 * Normalize weather text or emoji
 */
export function normalizeWeather(text: string): string | null {
  if (!text) return null;
  if (/☁️|cloud|overcast|cloudy|🌥️/i.test(text)) return 'Cloudy';
  if (/☀️|sunny|clear|hot/i.test(text)) return 'Sunny';
  if (/🌧️|rain|raining|wet|shower/i.test(text)) return 'Rainy';
  if (/⛅|partly/i.test(text)) return 'Partly Cloudy';
  if (/🌫️|fog|mist|haze/i.test(text)) return 'Foggy';

  const m = text.match(/weather\s*[:\-\s]*([a-zA-Z\u{1F300}-\u{1F9FF}]+)/iu);
  if (m) return m[1].trim();

  return null;
}

/**
 * Normalize sales condition
 */
export function normalizeSalesStatus(text: string): string | null {
  if (!text) return null;
  if (/sales?\s*(?:is|was|:)?\s*slow|selling\s*slow|slow\s*sales?|market\s*slow|mand|mandi\s*slow/i.test(text)) return 'Slow';
  if (/sales?\s*(?:is|was|:)?\s*fast|selling\s*fast|fast\s*sales?|market\s*fast|tez/i.test(text)) return 'Fast';
  if (/sales?\s*(?:is|was|:)?\s*normal|regular|medium|moderate/i.test(text)) return 'Normal';
  if (/sales?\s*(?:is|was|:)?\s*strong|heavy|high/i.test(text)) return 'Strong';
  if (/sales?\s*(?:is|was|:)?\s*weak|down/i.test(text)) return 'Weak';

  const m = text.match(/sales?\s*[:\-\s]*([a-zA-Z]+)/i);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();

  return null;
}

/**
 * Intelligent deterministic Rule-Based APMC Onion Market Parser
 */
export function parseMarketReportDeterministic(rawMessage: string): {
  normalized: MarketReportNormalized;
  isUnrelated: boolean;
} {
  const lines = rawMessage.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const text = rawMessage;

  // Check if message is completely unrelated
  const hasMarketKeyword = /apmc|bengaluru|bangalore|mandi|market|rates?|arrivals?|price|bags?|truck|onion|potato|aloo|batata|tomato|tamatar|garlic|lahsun|ginger|adrak|chilli|mirchi|lemon|carrot|cabbage|cauliflower|capsicum|brinjal|beans|quintal|kg\b/i.test(text);
  const hasNumbers = /\d{3,5}/.test(text);
  if (!hasMarketKeyword && !hasNumbers) {
    const emptyResult: MarketReportNormalized = {
      reportDate: null,
      reportDateDisplay: null,
      market: null,
      totalArrivals: null,
      truckCount: null,
      maharashtra: {
        extraBig: null,
        big: null,
        mukkal: null,
        medium: null,
        golta: null,
        golty: null,
        chopda: null,
        averageQuality: null
      },
      vijayapura: { rate: null },
      sections: [],
      newOnions: { state: null, bagCount: null, grades: [], rate: null, lotRate: null },
      commodities: [],
      salesStatus: null,
      weather: null,
      rateUnit: null,
      additionalInformation: [],
      confidence: {
        overall: 'low',
        date: 'low',
        market: 'low',
        arrivals: 'low',
        maharashtra: 'low',
        vijayapura: 'low',
        newOnions: 'low',
        commodities: 'low',
        salesStatus: 'low',
        weather: 'low'
      },
      missingFields: ['reportDate', 'market', 'rates'],
      warnings: ['This message does not appear to contain mandi/market rate data.']
    };
    return { normalized: emptyResult, isUnrelated: true };
  }

  // 1. Date
  const dateInfo = parseDate(text);

  // 2. Market name
  let market: string | null = null;
  if (/apmc\s+bengaluru|bangalore\s+apmc|bengaluru\s+onion\s+market|apmc\s+bangalore/i.test(text)) {
    market = 'APMC BENGALURU';
  } else if (/yeshwanthpur/i.test(text)) {
    market = 'APMC YESHWANTHPUR';
  } else if (/lasalgaon/i.test(text)) {
    market = 'APMC LASALGAON';
  } else if (/solapur/i.test(text)) {
    market = 'APMC SOLAPUR';
  } else if (/pune/i.test(text)) {
    market = 'APMC PUNE';
  } else {
    // Check line containing APMC or Market
    const mLine = lines.find(l => /apmc|market|mandi/i.test(l) && !/arrivals?|rate|onion/i.test(l));
    if (mLine) {
      market = mLine.replace(/[^\w\s]/g, '').trim().toUpperCase();
    } else {
      market = 'APMC BENGALURU'; // default standard market if implied
    }
  }

  // 3. Arrivals & Trucks
  const { arrivals, trucks } = parseArrivalsAndTrucks(text);

  // 4. Rate Unit
  let rateUnit: string | null = null;
  if (/100\s*kg|per\s*100\s*kg|for\s*100\s*kg/i.test(text)) {
    rateUnit = 'Per 100 kg (Quintal)';
  } else if (/50\s*kg|per\s*50\s*kg/i.test(text)) {
    rateUnit = 'Per 50 kg';
  } else if (/per\s*bag|bag\s*rate/i.test(text)) {
    rateUnit = 'Per Bag';
  } else if (/per\s*kg|1\s*kg/i.test(text)) {
    rateUnit = 'Per kg';
  } else {
    rateUnit = 'Per 100 kg'; // APMC default standard
  }

  // 5. Weather & Sales
  const weather = normalizeWeather(text);
  const salesStatus = normalizeSalesStatus(text);

  // 6. Maharashtra Onion Grades
  const mhRates: MarketReportNormalized['maharashtra'] = {
    extraBig: null,
    big: null,
    mukkal: null,
    medium: null,
    golta: null,
    golty: null,
    chopda: null,
    averageQuality: null
  };

  // Helper to extract rate from specific line patterns
  for (const line of lines) {
    const l = line.trim();

    // Extra Big / EB
    if (/^(?:extra\s*big|eb|ex\s*big)\b/i.test(l) || /(?:extra\s*big|eb\b)[^:\d]*[:\-\s.]*\s*(\d{3,5})/i.test(l)) {
      if (!mhRates.extraBig) mhRates.extraBig = parsePriceRange(l);
    }
    // Big (not extra big)
    else if (/^(?:big\b|big\s*quality|big\s*size|big\s*onion)/i.test(l) && !/extra/i.test(l)) {
      if (!mhRates.big) mhRates.big = parsePriceRange(l);
    }
    else if (/\bbig\b/i.test(l) && !/extra/i.test(l) && !mhRates.big) {
      mhRates.big = parsePriceRange(l);
    }

    // Mukkal / Mookal / 3/4
    if (/mukkal|mookal|3\/4|muckal/i.test(l)) {
      if (!mhRates.mukkal) mhRates.mukkal = parsePriceRange(l);
    }

    // Medium / MED
    if (/^(?:medium|med\b|med\s*quality|medium\s*quality)/i.test(l) || /\b(?:medium|med)\b/i.test(l)) {
      if (!mhRates.medium) mhRates.medium = parsePriceRange(l);
    }

    // Golta / Golte
    if (/\bgolt[ae]\b/i.test(l) && !/golty|golti/i.test(l)) {
      if (!mhRates.golta) mhRates.golta = parsePriceRange(l);
    }

    // Golty / Golti / Choti Golta
    if (/\bgolt[yi]\b|choti\s*golta/i.test(l)) {
      if (!mhRates.golty) mhRates.golty = parsePriceRange(l);
    }

    // Chopda / Chopada
    if (/chop[a]?da/i.test(l)) {
      if (!mhRates.chopda) mhRates.chopda = parsePriceRange(l);
    }

    // Average Quality / Avg Quality / Average
    if (/average|avg\s*quality|avg\b/i.test(l) && !/arrivals/i.test(l)) {
      if (!mhRates.averageQuality) mhRates.averageQuality = parsePriceRange(l);
    }
  }

  // 7. Karnataka / Vijayapura Rates
  let vijayapuraRate: PriceRange | null = null;
  const vjLine = lines.find(l => /vijayapur[a]?|bijapur/i.test(l));
  if (vjLine) {
    vijayapuraRate = parsePriceRange(vjLine);
    // If the rate was on the next line (e.g. "Karnataka Vijayapura onions \n Rates. 3000-3700")
    if (!vijayapuraRate) {
      const idx = lines.indexOf(vjLine);
      if (idx >= 0 && idx + 1 < lines.length && /rates?|\d{4}/i.test(lines[idx + 1])) {
        vijayapuraRate = parsePriceRange(lines[idx + 1]);
      }
    }
  }

  // 8. New Onions
  let newOnionState: string | null = null;
  let newOnionBags: string | null = null;
  let newOnionRate: PriceRange | null = null;
  let newOnionLotRate: PriceRange | null = null;

  const newOnionGrades: NewOnionGrade[] = [];

  const newOnionHeaderIdx = lines.findIndex(l => /new\s*onion|new\s*karnataka/i.test(l));
  if (newOnionHeaderIdx >= 0) {
    const headerLine = lines[newOnionHeaderIdx];

    // The section runs to the next section heading or trailing note, not for a
    // fixed number of lines: traders quote as many grades as they have that
    // day, and a window of six silently dropped the rest.
    const isSectionEnd = (l: string) =>
      /^\s*(?:sales|weather|rates?\s+for|note|thanks|regards)\b/i.test(l) ||
      /\b(?:maharashtra|vijayapura|nashik|bellary|hubli)\b/i.test(l);

    let sectionEnd = lines.length;
    for (let i = newOnionHeaderIdx + 1; i < lines.length; i++) {
      if (isSectionEnd(lines[i])) { sectionEnd = i; break; }
    }
    // Body only. The header carries the bag count ("15,000+ bags") and reading
    // a rate off it produced a phantom quote of 0.
    const bodyLines = lines.slice(newOnionHeaderIdx + 1, sectionEnd);
    const subText = [headerLine, ...bodyLines].join(' ');

    if (/karnataka/i.test(subText)) newOnionState = 'Karnataka';

    // Bag count: preserve 7000+, 7,000+ bags
    const bagMatch = subText.match(/([0-9,.]+\s*\+?)\s*bags?/i);
    if (bagMatch) {
      newOnionBags = bagMatch[1].replace(/\s+/g, '') + ' bags';
    }

    // A grade row is a name followed by a rate: "Medium. 4200-4800". The name
    // is required, so a bare bag-count or total line can never become a grade.
    // The currency group is optional but must be allowed: WhatsApp messages
    // routinely write "Medium. Rs.4200-4800" or "Medium. ₹4200-4800", and without
    // it the row simply failed to match and the grade was dropped.
    const GRADE_RE = /^\s*([A-Za-z][A-Za-z ()/.&-]*?)\s*[:.\-|]*\s*(?:₹|Rs\.?|INR)?\s*((?:\d[\d,]*)\s*(?:[-–—/]|to)\s*(?:₹|Rs\.?|INR)?\s*(?:\d[\d,]*)|\d[\d,]*)\s*$/i;

    for (const line of bodyLines) {
      if (/\bbags?\b/i.test(line)) continue;

      // The lot rate is its own field and is usually written with a leading
      // number ("1-2 lot 3500-3800"), which no grade label ever has - so it is
      // matched before GRADE_RE rather than through it.
      if (/\blot\b/i.test(line)) {
        const lotRate = parsePriceRange(line.replace(/^\s*[\d\s-]*lot\b/i, ' '));
        if (lotRate) newOnionLotRate = lotRate;
        continue;
      }

      const m = line.match(GRADE_RE);
      if (!m) continue;
      const label = m[1].replace(/[.\s]+$/, '').trim();
      if (!label || /^(?:total|sales|weather)$/i.test(label)) continue;
      const rate = parsePriceRange(m[2]);
      if (!rate) continue;

      newOnionGrades.push({ label: label.toUpperCase(), rate });
    }

    // A single unlabelled rate ("Rates. 4000-4600") stays in `rate` so the
    // one-row layout and every stored report keep working unchanged.
    if (newOnionGrades.length === 1 && /^rates?$/i.test(newOnionGrades[0].label)) {
      newOnionRate = newOnionGrades[0].rate;
      newOnionGrades.length = 0;
    }

    // Last resort for a section that quoted a bare rate with no label at all.
    if (newOnionGrades.length === 0 && !newOnionRate) {
      const rateLine = bodyLines.find(l => !/\blot\b/i.test(l) && !/\bbags?\b/i.test(l) && parsePriceRange(l));
      if (rateLine) newOnionRate = parsePriceRange(rateLine);
    }
  }

  // 9. Dynamic Vegetables & Custom Commodities
  const commodities: CommodityItem[] = [];
  const knownVegs: { pattern: RegExp; defaultName: string; defaultUnit?: string }[] = [
    { pattern: /\b(?:potato(?:es)?|aloo|batata)\b/i, defaultName: 'POTATO (ALOO)', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:tomato(?:es)?|tamatar)\b/i, defaultName: 'TOMATO', defaultUnit: 'Per 25 kg box' },
    { pattern: /\b(?:garlic|lahsun|lasun)\b/i, defaultName: 'GARLIC (LAHSUN)', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:ginger|adrak)\b/i, defaultName: 'GINGER (ADRAK)', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:green\s*chilli|green\s*chili|mirchi|chilli|chili)\b/i, defaultName: 'GREEN CHILLI', defaultUnit: 'Per 50 kg' },
    { pattern: /\b(?:lemon|nimbu|limbu)\b/i, defaultName: 'LEMON (NIMBU)', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:carrot|gajar)\b/i, defaultName: 'CARROT', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:cabbage|patta\s*gobi|bandagobi)\b/i, defaultName: 'CABBAGE', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:cauliflower|phool\s*gobi)\b/i, defaultName: 'CAULIFLOWER', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:capsicum|shimla\s*mirch)\b/i, defaultName: 'CAPSICUM', defaultUnit: 'Per 50 kg' },
    { pattern: /\b(?:brinjal|eggplant|baingan)\b/i, defaultName: 'BRINJAL', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:beans|french\s*beans)\b/i, defaultName: 'BEANS', defaultUnit: 'Per 50 kg' },
    { pattern: /\b(?:beetroot|chukandar)\b/i, defaultName: 'BEETROOT', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:drumstick|sehjan)\b/i, defaultName: 'DRUMSTICK', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:lady\s*finger|bhindi|okra)\b/i, defaultName: 'LADYFINGER (BHINDI)', defaultUnit: 'Per 50 kg' },
    { pattern: /\b(?:peas|matar)\b/i, defaultName: 'PEAS (MATAR)', defaultUnit: 'Per 50 kg' },
    { pattern: /\b(?:cucumber|kheera)\b/i, defaultName: 'CUCUMBER', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:radish|mooli)\b/i, defaultName: 'RADISH (MOOLI)', defaultUnit: 'Per 100 kg' },
    { pattern: /\b(?:coriander|kothmir|dhaniya)\b/i, defaultName: 'CORIANDER', defaultUnit: 'Per bundle' }
  ];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;

    // Skip lines that match arrivals, date, sales, weather, standard MH/KA onion headings
    if (/^(?:date|apmc|arrival|truck|sale|weather|maharashtra|vijayapura|rate\s*for|rates?\s*for|100\s*kg)/i.test(l)) {
      continue;
    }

    // Check if line matches known vegetable
    const matchedVeg = knownVegs.find(v => v.pattern.test(l));
    let parsedRate = parsePriceRange(l);

    // If rate wasn't on same line, lookahead 1 line
    if (matchedVeg && !parsedRate && i + 1 < lines.length) {
      parsedRate = parsePriceRange(lines[i + 1]);
    }

    if (matchedVeg && parsedRate) {
      const existing = commodities.find(c => c.name.toLowerCase() === matchedVeg.defaultName.toLowerCase());
      if (!existing) {
        const varietyMatch = l.match(/\(([^)]+)\)/);
        const variety = varietyMatch ? varietyMatch[1] : null;
        const unitMatch = l.match(/(?:per|\/)\s*(\d*\s*(?:kg|quintal|qtl|bag|box|crate|bundle))/i);
        const unit = unitMatch ? `Per ${unitMatch[1].trim()}` : matchedVeg.defaultUnit || null;

        commodities.push({
          name: matchedVeg.defaultName,
          variety,
          rate: parsedRate,
          unit,
          isHighlight: true
        });
      }
    } else if (l.includes(':') || l.includes(' - ') || l.includes(' – ')) {
      // Generic Custom Commodity / Vegetable detection: "<Name>: <Rate>"
      if (!/(?:extra\s*big|big\b|mukkal|medium|golta|golty|chopda|average|vijayapura|new\s*onion)/i.test(l)) {
        const parts = l.split(/[:–-]/);
        if (parts.length >= 2) {
          const possibleName = parts[0].trim().toUpperCase();
          const genericRate = parsePriceRange(parts.slice(1).join(' '));
          if (possibleName.length >= 3 && possibleName.length <= 30 && genericRate && !/^(?:TOTAL|DATE|TIME|ARRIVAL|TRUCK|NOTE|WEATHER|SALES)/i.test(possibleName)) {
            const alreadyExists = commodities.find(c => c.name === possibleName);
            if (!alreadyExists) {
              commodities.push({
                name: possibleName,
                rate: genericRate,
                unit: null,
                isHighlight: false
              });
            }
          }
        }
      }
    }
  }

  // 10. Additional information / unknown notes
  const additionalInformation: string[] = [];
  for (const line of lines) {
    const l = line.trim();
    if (/(?:garva|white\s*onion|red\s*onion|bhavnagar|nasik|indore|gujarat|patti|quality\s*good|demand|dispatch)/i.test(l)) {
      if (!additionalInformation.includes(l)) {
        additionalInformation.push(l);
      }
    }
  }

  // 11. Confidence & Missing fields calculation
  const missingFields: string[] = [];
  const warnings: string[] = [];

  const hasAnyRates = mhRates.big || mhRates.medium || mhRates.extraBig || vijayapuraRate || newOnionRate || newOnionGrades.length > 0 || commodities.length > 0;

  const confidence: ConfidenceScores = {
    overall: 'high',
    date: dateInfo.isoDate ? 'high' : 'low',
    market: market ? 'high' : 'medium',
    arrivals: arrivals ? 'high' : 'medium',
    maharashtra: (mhRates.big || mhRates.medium || mhRates.extraBig) ? 'high' : 'low',
    vijayapura: vijayapuraRate ? 'high' : 'medium',
    newOnions: (newOnionRate || newOnionGrades.length > 0 || newOnionBags) ? 'high' : 'medium',
    commodities: commodities.length > 0 ? 'high' : 'medium',
    salesStatus: salesStatus ? 'high' : 'medium',
    weather: weather ? 'high' : 'medium'
  };

  if (!dateInfo.isoDate) {
    missingFields.push('Date');
    warnings.push('Date could not be determined with high certainty. Please verify.');
  }
  if (!arrivals) {
    missingFields.push('Arrivals');
  }
  if (!hasAnyRates) {
    missingFields.push('Market Rates');
    warnings.push('No primary market rates or commodities could be identified.');
    confidence.overall = 'low';
  } else if (missingFields.length > 0) {
    confidence.overall = 'medium';
  }

  const normalized: MarketReportNormalized = {
    reportDate: dateInfo.isoDate,
    reportDateDisplay: dateInfo.displayDate,
    market,
    totalArrivals: arrivals,
    truckCount: trucks,
    // Structure-driven view of the whole message. The named fields below stay
    // populated so stored reports and the existing screens keep working.
    sections: parseSections(lines),

    maharashtra: mhRates,
    vijayapura: { rate: vijayapuraRate },
    newOnions: {
      state: newOnionState,
      bagCount: newOnionBags,
      grades: newOnionGrades,
      rate: newOnionRate,
      lotRate: newOnionLotRate
    },
    commodities,
    salesStatus,
    weather,
    rateUnit,
    additionalInformation,
    confidence,
    missingFields,
    warnings
  };

  return { normalized, isUnrelated: false };
}
