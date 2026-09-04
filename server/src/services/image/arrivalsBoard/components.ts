import { renderIcon, commodityIconName } from '../icons';
import { commodityPhotoDataUri } from '../commodityPhotos';
import { widthOf, fitSize, wrapToWidth } from '../textMetrics';
import {
  BoardPlan,
  ColumnPlan,
  MarketPlan,
  RowPlan,
  TotalPlan,
  BORDER,
  COL_PAD,
  CANVAS_W,
  CONTENT_W,
  DATE_BAR_H,
  DISPLAY_WEIGHT,
  BODY_WEIGHT,
  FONT_BODY,
  FONT_DISPLAY,
  HEADER_H,
  MARGIN,
  SIZE,
  TRUCK_W,
  VISUAL_W,
  BRANDING_H,
} from './layout';

/**
 * The board's drawing components.
 *
 * Each function renders one block of the board and nothing else: it is handed
 * the geometry the layout pass already decided and returns an SVG fragment.
 * None of them measure, choose a size, or know what comes above or below them,
 * which is what lets the board carry any number of markets and rows without a
 * separate code path per shape of report.
 */

export interface BoardTheme {
  paper: string;
  headerBg: string;
  headerText: string;
  headerAccent: string;
  dateBarBg: string;
  dateBarText: string;
  dateChipBg: string;
  dateChipText: string;
  marketBg: string;
  marketText: string;
  rowA: string;
  rowB: string;
  rowLine: string;
  productText: string;
  arrivalBg: string;
  arrivalText: string;
  unitText: string;
  vehicleBg: string;
  vehicleText: string;
  totalBg: string;
  totalLabelText: string;
  totalNumberText: string;
}

/**
 * Colours are the one thing on this board that is free to change: the spec
 * ranks size, density and hierarchy far above palette. What matters here is
 * contrast — every text colour below sits on a background it stays legible on
 * when the image is forwarded, recompressed and viewed on a cheap screen.
 */
export const DEFAULT_THEME: BoardTheme = {
  paper: '#f7f3e8',
  headerBg: '#0f2f52',
  headerText: '#ffffff',
  headerAccent: '#ffd54a',
  dateBarBg: '#c8102e',
  dateBarText: '#ffffff',
  dateChipBg: '#ffd54a',
  dateChipText: '#7a1020',
  marketBg: '#134e2f',
  marketText: '#ffffff',
  rowA: '#ffffff',
  rowB: '#f0ece0',
  rowLine: '#0f2f52',
  productText: '#10233d',
  arrivalBg: '#fff3c4',
  arrivalText: '#b3121f',
  unitText: '#33415c',
  vehicleBg: '#0f2f52',
  vehicleText: '#ffe14a',
  totalBg: '#134e2f',
  totalLabelText: '#ffffff',
  totalNumberText: '#ffe14a',
};

/** Diameter of the shop mark in the branding band, shared with the renderer
 * that composites the photograph onto it. */
export const BRAND_LOGO = 118;

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface TextOpts {
  anchor?: 'start' | 'middle' | 'end';
  family?: string;
  weight?: number;
  letterSpacing?: number;
}

/** One line of text. Baseline positioning is the caller's business. */
function text(content: string, x: number, y: number, size: number, fill: string, opts: TextOpts = {}): string {
  const { anchor = 'start', family = FONT_DISPLAY, weight = DISPLAY_WEIGHT, letterSpacing = 0.5 } = opts;
  return (
    `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" ` +
    `fill="${fill}" text-anchor="${anchor}" letter-spacing="${letterSpacing}">${escapeXml(content)}</text>`
  );
}

/**
 * Top header: the committee name and where it sits. Two lines, both as large as
 * they can be, on a solid band — a market bulletin heading, not a logo lockup.
 */
export function renderHeader(plan: BoardPlan, committeeName: string, location: string, theme: BoardTheme): string {
  return `
    <g id="board-header">
      <rect x="0" y="${plan.headerY}" width="${CANVAS_W}" height="${HEADER_H}" fill="${theme.headerBg}" />
      <rect x="0" y="${plan.headerY + HEADER_H - 10}" width="${CANVAS_W}" height="10" fill="${theme.dateChipBg}" />
      ${text(committeeName.toUpperCase(), CANVAS_W / 2, plan.headerY + 76, plan.committeeSize, theme.headerText, {
        anchor: 'middle',
      })}
      ${text(location.toUpperCase(), CANVAS_W / 2, plan.headerY + 138, SIZE.location, theme.dateChipBg, {
        anchor: 'middle',
      })}
    </g>
  `;
}

/**
 * Date strip: DATE | 27-08-2026 | THURSDAY ARRIVALS.
 *
 * The date is chipped out on a contrasting block because it is the one field
 * that changes every single day — a reader checking whether the board is
 * today's should find it without reading anything else.
 */
export function renderDateBar(plan: BoardPlan, dateDisplay: string, weekday: string | null, theme: BoardTheme): string {
  const y = plan.dateBarY;
  const labelX = MARGIN + 24;
  const labelW = widthOf('DATE', FONT_BODY, BODY_WEIGHT, SIZE.dateLabel);
  const chipX = labelX + labelW + 28;
  const chipW = widthOf(dateDisplay, FONT_DISPLAY, DISPLAY_WEIGHT, SIZE.date) + 56;
  const weekdayText = weekday ? `${weekday.toUpperCase()} ARRIVALS` : 'ARRIVALS';

  return `
    <g id="board-date">
      <rect x="0" y="${y}" width="${CANVAS_W}" height="${DATE_BAR_H}" fill="${theme.dateBarBg}" />
      ${text('DATE', labelX, y + DATE_BAR_H / 2 + 14, SIZE.dateLabel, theme.dateBarText, {
        family: FONT_BODY,
        weight: BODY_WEIGHT,
      })}
      <rect x="${chipX}" y="${y + 22}" width="${chipW}" height="${DATE_BAR_H - 44}" rx="10" fill="${theme.dateChipBg}" />
      ${text(dateDisplay, chipX + chipW / 2, y + DATE_BAR_H / 2 + 21, SIZE.date, theme.dateChipText, {
        anchor: 'middle',
      })}
      ${text(weekdayText, CANVAS_W - MARGIN - 24, y + DATE_BAR_H / 2 + 13, SIZE.weekday, theme.dateBarText, {
        anchor: 'end',
        family: FONT_BODY,
        weight: BODY_WEIGHT,
      })}
    </g>
  `;
}

/** Full-width band naming one market. Repeated identically for every market. */
export function renderMarketHeader(market: MarketPlan, theme: BoardTheme): string {
  return `
    <g id="market-header">
      <rect x="${MARGIN}" y="${market.y}" width="${CONTENT_W}" height="${market.headerH}" fill="${theme.marketBg}" />
      ${text(market.name, MARGIN + 28, market.y + market.headerH / 2 + market.nameSize / 3, market.nameSize, theme.marketText)}
    </g>
  `;
}

/**
 * The vehicle end of a row: a truck big enough to read as a truck, the count at
 * near-headline size, and the word VEHICLES under it.
 */
export function renderVehicleCell(row: RowPlan, columns: ColumnPlan, theme: BoardTheme): string {
  const cx = columns.vehicleX;
  const cy = row.y;
  // The truck scales with the row so a compact board does not carry a truck
  // taller than the count beside it.
  const truckSize = Math.min(TRUCK_W, Math.round(row.h * 0.44));
  const truckY = cy + row.h / 2 - truckSize / 2;
  const numberX = cx + COL_PAD + truckSize + 12;
  const numberW = columns.vehicleW - COL_PAD * 2 - truckSize - 12;

  return `
    <g id="vehicle-cell">
      <rect x="${cx}" y="${cy}" width="${columns.vehicleW}" height="${row.h}" fill="${theme.vehicleBg}" />
      ${renderIcon('truck', cx + COL_PAD, truckY, truckSize, theme.vehicleText)}
      ${text(row.product.vehicles, numberX + numberW / 2, cy + row.h / 2 - columns.vehLabelSize / 2 + columns.vehicleSize / 3, columns.vehicleSize, theme.vehicleText, {
        anchor: 'middle',
      })}
      ${text('VEHICLES', numberX + numberW / 2, cy + row.h / 2 + columns.vehicleSize / 2 + columns.vehLabelSize, columns.vehLabelSize, theme.vehicleText, {
        anchor: 'middle',
        family: FONT_BODY,
        weight: BODY_WEIGHT,
      })}
    </g>
  `;
}

/**
 * One product row: visual, name, arrival count, unit, vehicles.
 *
 * Every x position comes from the shared ColumnPlan, so the columns line up
 * down the whole board however many markets or rows it carries.
 */
export function renderProductRow(row: RowPlan, columns: ColumnPlan, index: number, theme: BoardTheme): string {
  const bg = index % 2 === 0 ? theme.rowA : theme.rowB;
  const midY = row.y + row.h / 2;
  const icon = commodityIconName(row.product.name);

  // A real photo when the shop has supplied one for this commodity, the vector
  // icon otherwise.
  const photo = commodityPhotoDataUri(icon);
  let visual: string;
  if (photo) {
    // The photo gets the whole cell — almost the full column width and the row
    // height bar a small margin. `meet` preserves the cutout's aspect ratio, so
    // a landscape shot fills the width and a portrait one fills the height,
    // neither is stretched.
    const boxW = VISUAL_W - 4;
    const boxH = row.h - 8;
    const boxX = columns.visualX + (VISUAL_W - boxW) / 2;
    const boxY = midY - boxH / 2;
    visual =
      `<image x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" ` +
      `preserveAspectRatio="xMidYMid meet" xlink:href="${photo}" />`;
  } else {
    // The vector icon is square; it fills most of the row's height.
    const visualSize = Math.min(VISUAL_W - 8, Math.round(row.h * 0.9));
    visual = renderIcon(icon, columns.visualX + (VISUAL_W - visualSize) / 2, midY - visualSize / 2, visualSize);
  }

  // A single line sits on the row's centre; two lines straddle it.
  const firstBaseline =
    row.nameLines.length > 1 ? midY - row.nameSize * 0.15 : midY + row.nameSize / 3;
  const nameSvg = row.nameLines
    .map((line, i) => text(line, columns.nameX + COL_PAD, firstBaseline + i * (row.nameSize + 8), row.nameSize, theme.productText))
    .join('\n      ');

  return `
    <g id="product-row">
      <rect x="${MARGIN}" y="${row.y}" width="${CONTENT_W}" height="${row.h}" fill="${bg}" />
      ${visual}
      ${nameSvg}
      <rect x="${columns.arrivalX}" y="${row.y + 16}" width="${columns.arrivalW}" height="${row.h - 32}" rx="12" fill="${theme.arrivalBg}" />
      ${text(row.product.arrival, columns.arrivalX + columns.arrivalW / 2, midY + columns.arrivalSize / 3, columns.arrivalSize, theme.arrivalText, {
        anchor: 'middle',
      })}
      ${text(row.product.unit.toUpperCase(), columns.unitX + columns.unitW / 2, midY + columns.unitSize / 3, columns.unitSize, theme.unitText, {
        anchor: 'middle',
        family: FONT_BODY,
        weight: BODY_WEIGHT,
      })}
      ${renderVehicleCell(row, columns, theme)}
      <line x1="${MARGIN}" y1="${row.y + row.h}" x2="${MARGIN + CONTENT_W}" y2="${row.y + row.h}" stroke="${theme.rowLine}" stroke-width="${BORDER}" />
      <line x1="${columns.arrivalX - COL_PAD}" y1="${row.y}" x2="${columns.arrivalX - COL_PAD}" y2="${row.y + row.h}" stroke="${theme.rowLine}" stroke-width="2" opacity="0.35" />
      <line x1="${columns.unitX}" y1="${row.y}" x2="${columns.unitX}" y2="${row.y + row.h}" stroke="${theme.rowLine}" stroke-width="2" opacity="0.35" />
    </g>
  `;
}

/**
 * Closing summary. The total is the largest number on the board; when the board
 * carries more than one market, the split that produced it is shown beside the
 * total the way the market itself writes it: 300 + 13 = 313.
 */
export function renderTotalVehicles(total: TotalPlan, theme: BoardTheme): string {
  const y = total.y;
  const expression =
    total.parts.length > 1 ? `${total.parts.join(' + ')} = ${total.total}` : '';

  return `
    <g id="total-vehicles">
      <rect x="${MARGIN}" y="${y}" width="${CONTENT_W}" height="${total.h}" fill="${theme.totalBg}" />
      ${renderIcon('truck', MARGIN + 34, y + total.h / 2 - 55, 110, theme.totalNumberText)}
      ${text('TOTAL VEHICLES', MARGIN + 170, y + total.h / 2 - 10, SIZE.totalLabel, theme.totalLabelText)}
      ${
        expression
          ? text(expression, MARGIN + 170, y + total.h / 2 + 46, SIZE.totalParts, theme.totalLabelText, {
              family: FONT_BODY,
              weight: BODY_WEIGHT,
            })
          : ''
      }
      ${text(String(total.total), MARGIN + CONTENT_W - 40, y + total.h / 2 + SIZE.totalNumber / 3, SIZE.totalNumber, theme.totalNumberText, {
        anchor: 'end',
      })}
    </g>
  `;
}

/**
 * Shop branding, opening the board.
 *
 * It sits above the committee's heading because this is the shop's daily
 * message, not a reprint of the committee's notice — whoever receives it
 * should see who sent it before they read what it says.
 *
 * Everything is centred on one axis: mark, name, trade line, both numbers,
 * address. A left-aligned block with the logo beside it reads as a letterhead;
 * centred and stacked reads as a masthead, which is what this is.
 */
export function renderBranding(
  plan: BoardPlan,
  settings: {
    shopName?: string;
    footerTagline?: string;
    phone?: string;
    whatsapp?: string;
    apmcAddress?: string;
  },
  theme: BoardTheme,
  hasLogo: boolean
): string {
  const y = plan.brandingY;
  const cx = CANVAS_W / 2;
  const name = (settings.shopName || '').toUpperCase();
  const tagline = (settings.footerTagline || '').toUpperCase();
  const numbers = [settings.phone, settings.whatsapp].filter((n): n is string => Boolean(n && n.trim()));
  const address = settings.apmcAddress || '';

  const avail = CONTENT_W - 80;

  /**
   * Tracking widens what is drawn without widening what was measured, so it is
   * charged against the space before fitting — the trap that clipped the
   * branded upload's tagline off the right edge.
   */
  const TRACKING = 0.4;
  const nameSize = fitSize(name, FONT_DISPLAY, DISPLAY_WEIGHT, 68, 30, avail - name.length * TRACKING);
  const taglineSize = tagline
    ? fitSize(tagline, FONT_BODY, BODY_WEIGHT, 26, 13, avail - tagline.length * TRACKING)
    : 0;

  const numberSize = numbers.length
    ? numbers.reduce(
        (smallest, n) => Math.min(smallest, fitSize(n, FONT_DISPLAY, DISPLAY_WEIGHT, 38, 18, avail / numbers.length - 40)),
        38
      )
    : 0;

  /**
   * The address gets a light plaque and display weight.
   *
   * Set small in body weight on the dark band it was the faintest thing on the
   * board, and it is the line a stranger reads to find the shop. Dark on cream
   * is the strongest contrast this palette offers.
   *
   * Sized for the two lines it will occupy rather than the one `fitSize`
   * assumes — measuring the whole address against a single line's width
   * collapses it toward the floor while the second line sits empty — then
   * stepped down while the wrap is still clipping anything.
   */
  const plaqueX = MARGIN + 24;
  const plaqueW = CONTENT_W - 48;
  const addrAvail = plaqueW - 44;
  let addressSize = fitSize(address, FONT_DISPLAY, DISPLAY_WEIGHT, 40, 20, addrAvail * 2 - 40);
  let addressLines = wrapToWidth(address, FONT_DISPLAY, DISPLAY_WEIGHT, addressSize, addrAvail, 2);
  while (addressSize > 20 && addressLines.some(line => line.includes('…'))) {
    addressSize -= 2;
    addressLines = wrapToWidth(address, FONT_DISPLAY, DISPLAY_WEIGHT, addressSize, addrAvail, 2);
  }
  const plaqueH = addressLines.length > 1 ? addressSize * 2 + 34 : addressSize + 32;

  // Stacked from the logo down, each row placed off the one above it rather
  // than from hardcoded offsets, so a missing logo or tagline closes the gap.
  const logoBottom = y + (hasLogo ? 20 + BRAND_LOGO : 14);
  const nameBaseline = logoBottom + nameSize + 6;
  const taglineBaseline = tagline ? nameBaseline + taglineSize + 12 : nameBaseline;
  const numbersBaseline = taglineBaseline + numberSize + 18;
  const addressTop = numbersBaseline + 10;

  const numbersRow = numbers
    .map((n, i) => {
      const slot = avail / numbers.length;
      const centre = MARGIN + 40 + slot * i + slot / 2;
      return text(n, centre, numbersBaseline, numberSize, theme.dateChipBg, { anchor: 'middle' });
    })
    .join('\n      ');

  return `
    <g id="shop-branding">
      <rect x="${MARGIN}" y="${y}" width="${CONTENT_W}" height="${BRANDING_H}" rx="16" fill="${theme.headerBg}" />
      <rect x="${MARGIN}" y="${y + BRANDING_H - 6}" width="${CONTENT_W}" height="6" fill="${theme.dateChipBg}" />

      ${text(name, cx, nameBaseline, nameSize, theme.dateChipBg, { anchor: 'middle', letterSpacing: TRACKING })}
      ${tagline ? text(tagline, cx, taglineBaseline, taglineSize, theme.headerText, { anchor: 'middle', family: FONT_BODY, weight: BODY_WEIGHT, letterSpacing: TRACKING }) : ''}

      ${numbersRow}

      <rect x="${plaqueX}" y="${addressTop}" width="${plaqueW}" height="${plaqueH}" rx="14"
            fill="${theme.paper}" stroke="${theme.dateChipBg}" stroke-width="3" />
      ${addressLines
        .map((line, i) =>
          text(
            line,
            cx,
            addressTop + (plaqueH - (addressLines.length - 1) * (addressSize + 8)) / 2 + addressSize / 3 + i * (addressSize + 8),
            addressSize,
            theme.productText,
            { anchor: 'middle' }
          )
        )
        .join('\n      ')}
    </g>
  `;
}
