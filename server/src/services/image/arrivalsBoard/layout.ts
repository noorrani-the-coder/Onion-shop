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

export const FONT_DISPLAY = "'Anton', 'Arial Black', Impact, sans-serif";
export const FONT_BODY = "'Roboto Condensed', 'Segoe UI', Arial, sans-serif";
export const DISPLAY_WEIGHT = 400;
export const BODY_WEIGHT = 700;

/**
 * The type scale, in the order of the board's visual hierarchy: arrival numbers
 * dominate, then product names, then vehicle counts, then market names, then
 * everything else. The `*Min` entries are floors for the bounded fitting in
 * `fitColumnSizes` — they are not "small" sizes, just less enormous ones.
 */
export const SIZE = {
  committee: 62,
  committeeMin: 32,
  location: 52,
  dateLabel: 40,
  date: 58,
  weekday: 38,
  marketName: 58,
  marketNameMin: 40,
  productName: 58,
  productNameMin: 44,
  arrival: 82,
  arrivalMin: 62,
  unit: 34,
  vehicles: 70,
  vehiclesMin: 55,
  vehiclesLabel: 26,
  totalLabel: 54,
  totalNumber: 118,
  totalParts: 34,
} as const;

/**
 * Block heights. A row is deliberately tall: it holds a product visual, a name,
 * a five-digit number, a unit and a truck count, all at a size readable at a
 * glance on a phone. 300px at 1080 wide is the floor for that, not a target to
 * optimise downwards.
 */
export const ROW_H = 300;
export const ROW_H_WRAPPED = 360;
export const HEADER_H = 240;
export const DATE_BAR_H = 140;
export const MARKET_HEADER_H = 110;
export const TOTAL_BLOCK_H = 300;
export const SECTION_GAP = 24;
export const BORDER = 5;

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
function fitColumnSizes(products: ArrivalProduct[]): ColumnPlan {
  const arrivals = products.map(p => p.arrival);
  const units = products.map(p => p.unit.toUpperCase());
  const vehicles = products.map(p => p.vehicles);

  let arrivalSize: number = SIZE.arrival;
  let vehicleSize: number = SIZE.vehicles;

  // How narrow the name column may get is a property of the data, not a
  // constant: a name wraps between words but never inside one, so the widest
  // single word at the smallest allowed name size is the width below which
  // some row would have to be clipped. Capped, so one freak product name
  // cannot starve the numbers it sits beside.
  const longestWord = products
    .flatMap(p => p.name.toUpperCase().split(/\s+/))
    .reduce((max, word) => Math.max(max, widthOf(word, FONT_DISPLAY, DISPLAY_WEIGHT, SIZE.productNameMin)), 0);
  const minNameW = Math.min(Math.max(MIN_NAME_W, longestWord + COL_PAD * 2), CONTENT_W * 0.42);

  const unitW = Math.max(widest(units, FONT_BODY, BODY_WEIGHT, SIZE.unit) + COL_PAD * 2, MIN_UNIT_W);
  const vehLabelW = widthOf('VEHICLES', FONT_BODY, BODY_WEIGHT, SIZE.vehiclesLabel);

  const arrivalWidthAt = (size: number) => widest(arrivals, FONT_DISPLAY, DISPLAY_WEIGHT, size) + COL_PAD * 2;
  const vehicleWidthAt = (size: number) =>
    TRUCK_W + 10 + Math.max(widest(vehicles, FONT_DISPLAY, DISPLAY_WEIGHT, size), vehLabelW) + COL_PAD * 2;
  const nameWidthWith = (aSize: number, vSize: number) =>
    CONTENT_W - VISUAL_W - arrivalWidthAt(aSize) - unitW - vehicleWidthAt(vSize);

  // Clamped, not just decremented: a 2px step from 56 would otherwise land on
  // 54 and quietly break the floor it was meant to respect.
  while (nameWidthWith(arrivalSize, vehicleSize) < minNameW && vehicleSize > SIZE.vehiclesMin) {
    vehicleSize = Math.max(SIZE.vehiclesMin, vehicleSize - 2);
  }
  while (nameWidthWith(arrivalSize, vehicleSize) < minNameW && arrivalSize > SIZE.arrivalMin) {
    arrivalSize = Math.max(SIZE.arrivalMin, arrivalSize - 2);
  }
  // Last resort, and the reason it exists: a long single-word product name
  // ("BEETROOT", "CUCUMBER") can still leave the name column under its own
  // floor once both numbers are at theirs. The product name outranks the
  // vehicle count in the hierarchy, so the vehicle count is what gives — below
  // its preferred floor, never below legibility.
  while (nameWidthWith(arrivalSize, vehicleSize) < minNameW && vehicleSize > VEHICLES_HARD_MIN) {
    vehicleSize = Math.max(VEHICLES_HARD_MIN, vehicleSize - 2);
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

  const columns = fitColumnSizes(allProducts(data));
  const committeeSize = fitSize(
    data.committeeName.toUpperCase(),
    FONT_DISPLAY,
    DISPLAY_WEIGHT,
    SIZE.committee,
    SIZE.committeeMin,
    CONTENT_W - 40
  );

  let y = 0;
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

      let nameSize = fitSize(name, FONT_DISPLAY, DISPLAY_WEIGHT, SIZE.productName, SIZE.productNameMin, avail);
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

      const h = nameLines.length > 1 ? ROW_H_WRAPPED : ROW_H;
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
    canvasH: Math.ceil(y),
    committeeSize,
    headerY,
    dateBarY,
    markets,
    columns,
    total,
  };
}
