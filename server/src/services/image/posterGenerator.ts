// Must precede the sharp import - see fontconfig.ts.
import './fontconfig';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { MarketReportNormalized, ShopSettings } from '../../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { ASSETS_DIR as SERVER_ASSETS_DIR, PUBLIC_DIR as SERVER_PUBLIC_DIR } from '../../paths';
import { warmTextMetrics, widthOf, fitSize, truncateToWidth } from './textMetrics';
import { renderIcon, commodityIconName, weatherIconName } from './icons';

const PUBLIC_DIR = SERVER_PUBLIC_DIR;
const POSTERS_DIR = path.join(PUBLIC_DIR, 'posters');
if (!fs.existsSync(POSTERS_DIR)) {
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
}

interface ThemeConfig {
  frameColor: string;
  paperBgStart: string;
  paperBgEnd: string;
  titleColor: string;
  subtitleColor: string;
  dateBadgeColor: string;
  arrivalsBarColor: string;
  mhHeaderColor: string;
  vjHeaderColor: string;
  newOnionHeaderColor: string;
  vegHeaderColor: string;
  footerBarColor: string;
  weatherBarColor: string;
  shopNameColor: string;
  pillA: string;
  pillB: string;
  addressBg: string;
  addressBorder: string;
  addressText: string;
}

const THEMES: Record<ShopSettings['themeId'], ThemeConfig> = {
  'emerald-classic': {
    frameColor: '#14532d',
    paperBgStart: '#fdf6df',
    paperBgEnd: '#f4e9c4',
    titleColor: '#b91c1c',
    subtitleColor: '#14532d',
    dateBadgeColor: '#1d4ed8',
    arrivalsBarColor: '#15803d',
    mhHeaderColor: '#581c87',
    vjHeaderColor: '#15803d',
    newOnionHeaderColor: '#9d174d',
    vegHeaderColor: '#581c87',
    footerBarColor: '#1e293b',
    weatherBarColor: '#1e3a8a',
    shopNameColor: '#7f1d1d',
    pillA: '#15803d',
    pillB: '#9d174d',
    addressBg: '#dcfce7',
    addressBorder: '#15803d',
    addressText: '#14532d'
  },
  'sapphire-modern': {
    frameColor: '#0c4a6e',
    paperBgStart: '#f3f8fb',
    paperBgEnd: '#dbeafe',
    titleColor: '#0369a1',
    subtitleColor: '#0c4a6e',
    dateBadgeColor: '#0284c7',
    arrivalsBarColor: '#0e7490',
    mhHeaderColor: '#1e3a8a',
    vjHeaderColor: '#0e7490',
    newOnionHeaderColor: '#7c2d92',
    vegHeaderColor: '#1e3a8a',
    footerBarColor: '#0f172a',
    weatherBarColor: '#1e3a8a',
    shopNameColor: '#0c4a6e',
    pillA: '#0e7490',
    pillB: '#1e3a8a',
    addressBg: '#dbeafe',
    addressBorder: '#0284c7',
    addressText: '#0c4a6e'
  },
  'ruby-wholesale': {
    frameColor: '#7f1d1d',
    paperBgStart: '#fdf3ec',
    paperBgEnd: '#fbe4d5',
    titleColor: '#b91c1c',
    subtitleColor: '#7f1d1d',
    dateBadgeColor: '#1d4ed8',
    arrivalsBarColor: '#9f1239',
    mhHeaderColor: '#831843',
    vjHeaderColor: '#9f1239',
    newOnionHeaderColor: '#4c0519',
    vegHeaderColor: '#831843',
    footerBarColor: '#1e293b',
    weatherBarColor: '#1e3a8a',
    shopNameColor: '#9f1239',
    pillA: '#9f1239',
    pillB: '#78350f',
    addressBg: '#ffe4e6',
    addressBorder: '#e11d48',
    addressText: '#881337'
  },
  'golden-harvest': {
    frameColor: '#78350f',
    paperBgStart: '#fdf6e3',
    paperBgEnd: '#f6e6bf',
    titleColor: '#b45309',
    subtitleColor: '#78350f',
    dateBadgeColor: '#1d4ed8',
    arrivalsBarColor: '#a16207',
    mhHeaderColor: '#7c2d12',
    vjHeaderColor: '#a16207',
    newOnionHeaderColor: '#9d174d',
    vegHeaderColor: '#7c2d12',
    footerBarColor: '#1e293b',
    weatherBarColor: '#1e3a8a',
    shopNameColor: '#78350f',
    pillA: '#a16207',
    pillB: '#7c2d12',
    addressBg: '#fef3c7',
    addressBorder: '#d97706',
    addressText: '#78350f'
  }
};

const RATE_TEXT_COLOR = '#b91c1c';
const RATE_BG_COLOR = '#fde047';
const RATE_BORDER_COLOR = '#ca8a04';
const LABEL_TEXT_COLOR = '#1e3a8a';
const ROW_BG_A = '#ffffff';
const ROW_BG_B = '#f3ecd2';
const CARD_BORDER = 'rgba(15, 23, 42, 0.18)';

// Font roles. All three faces are bundled in server/assets/fonts and registered
// at startup by ./fontconfig, so every machine draws the same poster:
//   Headings, labels and numbers -> Montserrat ExtraBold (weight 800)
//   Table sub-text               -> Roboto Condensed Bold
//   Small branding text          -> Montserrat ExtraBold
const FONT_HEADING = "'Montserrat', 'Arial Black', Impact, sans-serif";
const HEADING_WEIGHT = 800;
const FONT_TABLE = "'Roboto Condensed', 'Segoe UI', Arial, sans-serif";
const FONT_BRAND = "'Montserrat', 'Segoe UI', Arial, sans-serif";

// Row labels ("EXTRA BIG", "BIG", "MUKKAL"...) are drawn in the heavy display
// face, uppercase, so they carry the same weight as the rate pill beside them.
const FONT_LABEL = FONT_HEADING;
// Must match HEADING_WEIGHT: the display family is only bundled at 800, so a
// request for 400 finds nothing and drops through the stack — to Arial Black on
// Windows, which looks right, and to a thin default on Linux, which does not.
// That single mismatched number is what made the server's poster lighter than
// the one on the developer's screen.
const LABEL_WEIGHT = HEADING_WEIGHT;

/** Labels render uppercase; every measurement must use the same string. */
function labelDisplay(label: string): string {
  return label.toUpperCase();
}

// Instagram feed-post portrait canvas (4:5 — the tallest ratio Instagram's feed supports
// without auto-cropping; 2:3 or 9:16 get cropped when posted to the main feed).
const CANVAS_W = 1080;
/**
 * 9:16 is the frame this poster is designed around — the shape a phone shows
 * full-screen, and the height every block below is tuned for.
 *
 * It is a minimum, not a maximum. A report dense enough to need more room
 * (a full grade table plus a vegetables table) extends the canvas rather than
 * shrinking its own type: a poster nobody can read at a glance has failed at
 * the only job it has, whatever its aspect ratio.
 */
const CANVAS_H_MIN = 1920;

// Optional licensed photo assets — drop files at these paths to replace the
// emoji/icon accents with real photography. Any subset may be present; each
// is handled independently and falls back to the icon-based look if absent.
const ASSETS_DIR = path.join(SERVER_ASSETS_DIR, 'photos');
const ONION_PHOTO = path.join(ASSETS_DIR, 'onion.png');
const TRUCK_PHOTO = path.join(ASSETS_DIR, 'truck.png');
const WAREHOUSE_PHOTO = path.join(ASSETS_DIR, 'warehouse.png');
const LOGO_PHOTO = path.join(ASSETS_DIR, 'logo.png');

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getDayName(isoDate: string | null | undefined): string {
  if (!isoDate) return 'DAILY';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return 'DAILY';
    return d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  } catch {
    return 'DAILY';
  }
}

// Icon selection lives in ./icons — these now return icon *keys* (e.g. 'onion'),
// not emoji characters, and are drawn as inline SVG via renderIcon().
const getCommodityIcon = commodityIconName;
const getWeatherIcon = weatherIconName;

function getInitials(name: string): string {
  const words = name.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
  if (words.length === 0) return 'AP';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Layout gaps inside a rate row. LABEL_GAP is the guaranteed clear space
// between the end of the label's ink and the divider; PILL_GAP separates the
// divider from the rate pill; PILL_PAD is the pill's internal padding. Together
// they make label/rate collision geometrically impossible.
const LABEL_GAP = 14;
const PILL_GAP = 14;
const PILL_PAD = 12;

function rowLabelStartX(height: number): number {
  return (height - 14) + 20;
}

function rowBaseLabelSize(height: number): number {
  return height > 55 ? 50 : 41;
}

function rowBaseValueSize(height: number): number {
  return height > 55 ? 41 : 35;
}

/**
 * The rate is the number a trader reads first, so it is drawn heavier than the
 * display face alone can manage: Anton ships a single weight, and stroking the
 * glyphs in their own colour before the fill is painted thickens them without
 * changing the colour or the size.
 *
 * The stroke adds roughly this much to each side of the text. It is charged
 * against the pill's padding in the fitting below, so a widened rate still
 * cannot reach the pill's edge.
 */
const RATE_STROKE_W = 2;

const MIN_LABEL_SIZE = 22;
// A label is allowed to shrink to MIN_LABEL_SIZE to fit, but the pill column
// gives way before it drops below this — small beats clipped for a grade name.
const LABEL_COMFORT_SIZE = 32;
const MIN_VALUE_SIZE = 22;

/**
 * One divider position for a whole table, so every rate pill in it starts at the
 * same x and the column reads straight.
 *
 * The rate is the data traders actually read, so the pill is reserved first, at
 * its full base size: the divider can never slide past the point where the widest
 * rate in the table still fits unshrunk. Labels then take whatever room is left,
 * shrinking (and only as a last resort truncating) to fit it — which is what makes
 * a label/pill collision geometrically impossible without ever clipping a rate.
 */
function tableDividerX(rows: { label: string; value: string }[], width: number, height: number): number {
  const labelStartX = rowLabelStartX(height);
  const baseLabelSize = rowBaseLabelSize(height);
  const dividerFloor = labelStartX + 40;

  const pillRoom = (size: number) =>
    Math.min(
      ...rows.map(
        r => width - PILL_GAP - (widthOf(r.value, FONT_HEADING, HEADING_WEIGHT, size) + PILL_PAD * 2 + RATE_STROKE_W * 2)
      )
    );
  const labelRoom = (size: number) =>
    Math.max(...rows.map(r => labelStartX + widthOf(labelDisplay(r.label), FONT_LABEL, LABEL_WEIGHT, size) + LABEL_GAP));

  // The pill is reserved at full size first, so a rate never shrinks to make
  // room for a label. The exception is a narrow table whose label would then be
  // squeezed under LABEL_COMFORT_SIZE: there the divider may slide further right,
  // as far as the pill can shrink without going under MIN_VALUE_SIZE. Both stay
  // legible, and neither can ever be clipped.
  const dividerCeil = Math.max(
    dividerFloor,
    Math.min(pillRoom(MIN_VALUE_SIZE), Math.max(pillRoom(rowBaseValueSize(height)), labelRoom(LABEL_COMFORT_SIZE)))
  );

  const wants = Math.max(width * 0.56, labelRoom(baseLabelSize));
  return Math.min(wants, dividerCeil);
}

/**
 * One label size and one rate size for a whole table: the largest that every
 * row can carry.
 *
 * Sizing each row independently is what makes a rate board look ragged — a
 * short grade like CHOPDA renders half again as large as AVERAGE QUALITY
 * directly beneath it, and the eye reads the size difference as an importance
 * difference that the data does not have. Taking the minimum across the table
 * costs the short labels a few pixels and buys one clean column of type.
 */
function tableTypeSizes(
  rows: { label: string; value: string }[],
  width: number,
  height: number,
  dividerX: number
): { labelSize: number; valueSize: number } {
  const labelStartX = rowLabelStartX(height);
  const labelAvailW = dividerX - LABEL_GAP - labelStartX;
  const valueAvailW = width - dividerX - PILL_GAP - PILL_PAD * 2;

  let labelSize = rowBaseLabelSize(height);
  let valueSize = rowBaseValueSize(height);
  for (const r of rows) {
    labelSize = Math.min(
      labelSize,
      fitSize(labelDisplay(r.label), FONT_LABEL, LABEL_WEIGHT, rowBaseLabelSize(height), MIN_LABEL_SIZE, labelAvailW)
    );
    valueSize = Math.min(
      valueSize,
      fitSize(r.value, FONT_HEADING, HEADING_WEIGHT, rowBaseValueSize(height), MIN_VALUE_SIZE, valueAvailW)
    );
  }
  return { labelSize, valueSize };
}

// Renders one bold-label / bold-rate row: label to the left, a divider, a bold rate pill to the right.
// `dividerX` comes from tableDividerX so all rows of a table share one pill column.
function heritageRow(x: number, y: number, width: number, height: number, icon: string, label: string, sublabel: string | null, value: string, isAlt: boolean, dividerX: number, forced?: { labelSize: number; valueSize: number }): string {
  const rowBg = isAlt ? ROW_BG_B : ROW_BG_A;
  const iconBoxSize = height - 14;
  const labelStartX = rowLabelStartX(height);

  const baseLabelSize = rowBaseLabelSize(height);
  const baseValueSize = rowBaseValueSize(height);
  const minLabelSize = MIN_LABEL_SIZE;
  const minValueSize = MIN_VALUE_SIZE;

  const labelAvailW = dividerX - LABEL_GAP - labelStartX;
  const labelUpper = labelDisplay(label);
  const labelFontSize = forced
    ? forced.labelSize
    : fitSize(labelUpper, FONT_LABEL, LABEL_WEIGHT, baseLabelSize, minLabelSize, labelAvailW);
  const labelText = truncateToWidth(labelUpper, FONT_LABEL, LABEL_WEIGHT, labelFontSize, labelAvailW);

  const rateWidth = width - dividerX - PILL_GAP;
  const valueAvailW = rateWidth - PILL_PAD * 2 - RATE_STROKE_W * 2;
  const valueFontSize = forced
    ? forced.valueSize
    : fitSize(value, FONT_HEADING, HEADING_WEIGHT, baseValueSize, minValueSize, valueAvailW);
  const valueText = truncateToWidth(value, FONT_HEADING, HEADING_WEIGHT, valueFontSize, valueAvailW);

  const subFontSize = 22;
  const subText = sublabel ? truncateToWidth(sublabel, FONT_TABLE, 700, subFontSize, labelAvailW) : null;

  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${rowBg}" />
      <rect x="7" y="7" width="${iconBoxSize}" height="${iconBoxSize}" rx="8" fill="rgba(15,23,42,0.06)" />
      ${renderIcon(icon, 7 + (iconBoxSize - Math.min(26, iconBoxSize - 6)) / 2, 7 + (iconBoxSize - Math.min(26, iconBoxSize - 6)) / 2, Math.min(26, iconBoxSize - 6))}
      <text x="${labelStartX}" y="${subText ? height / 2 - 5 : height / 2 + 10}" font-family="${FONT_LABEL}" font-size="${labelFontSize}" font-weight="${LABEL_WEIGHT}" fill="${LABEL_TEXT_COLOR}" letter-spacing="0.2">${escapeXml(labelText)}</text>
      ${subText ? `<text x="${labelStartX}" y="${height / 2 + 19}" font-family="${FONT_TABLE}" font-size="${subFontSize}" font-weight="700" fill="#475569">${escapeXml(subText)}</text>` : ''}
      <line x1="${dividerX}" y1="8" x2="${dividerX}" y2="${height - 8}" stroke="rgba(15,23,42,0.15)" stroke-width="1.5" />
      <rect x="${dividerX + PILL_GAP}" y="6" width="${rateWidth}" height="${height - 12}" rx="10" fill="${RATE_BG_COLOR}" stroke="${RATE_BORDER_COLOR}" stroke-width="2.5" />
      <text x="${dividerX + PILL_GAP + rateWidth / 2}" y="${height / 2 + 11}" font-family="${FONT_HEADING}" font-size="${valueFontSize}" font-weight="${HEADING_WEIGHT}" fill="${RATE_TEXT_COLOR}" text-anchor="middle" stroke="${RATE_TEXT_COLOR}" stroke-width="${RATE_STROKE_W}" paint-order="stroke" stroke-linejoin="round">${escapeXml(valueText)}</text>
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="rgba(15,23,42,0.08)" stroke-width="1" />
    </g>
  `;
}

function sectionHeader(x: number, y: number, width: number, height: number, color: string, title: string, icon: string): string {
  const baseSize = width > 400 ? 39 : 30;
  // The icon is drawn as vector art rather than measured as a glyph, so it
  // claims a fixed gutter and the title is fitted to whatever is left.
  const iconSize = Math.min(32, height - 12);
  const titleX = 18 + iconSize + 10;
  const availW = width - titleX - 16;
  const size = fitSize(title, FONT_HEADING, HEADING_WEIGHT, baseSize, 22, availW);
  const text = truncateToWidth(title, FONT_HEADING, HEADING_WEIGHT, size, availW);
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="${color}" />
      <rect x="0" y="${height / 2}" width="${width}" height="${height / 2}" fill="${color}" />
      ${renderIcon(icon, 18, (height - iconSize) / 2, iconSize, '#ffffff')}
      <text x="${titleX}" y="${height / 2 + 10}" font-family="${FONT_HEADING}" font-size="${size}" font-weight="${HEADING_WEIGHT}" fill="#ffffff" letter-spacing="0.1">${escapeXml(text)}</text>
    </g>
  `;
}

export class PosterGenerator {
  public static async generatePoster(
    report: MarketReportNormalized,
    settings: ShopSettings
  ): Promise<{ fileName: string; absolutePath: string; urlPath: string }> {
    const themeId = settings.themeId || 'emerald-classic';
    const theme = THEMES[themeId] || THEMES['emerald-classic'];

    const hasOnionPhoto = fs.existsSync(ONION_PHOTO);
    const hasTruckPhoto = fs.existsSync(TRUCK_PHOTO);
    const hasWarehousePhoto = fs.existsSync(WAREHOUSE_PHOTO);
    const hasLogoPhoto = fs.existsSync(LOGO_PHOTO);

    const dateDisplay = report.reportDateDisplay || report.reportDate || new Date().toISOString().split('T')[0];
    const dayName = getDayName(report.reportDate);
    const marketRaw = report.market || 'BENGALURU';
    const marketShort = marketRaw.replace(/^APMC\s*/i, '').trim().toUpperCase() || 'BENGALURU';
    const rateUnit = report.rateUnit || 'Per 100 kg';

    // 1. Maharashtra onion rates, collected dynamically from the parsed message
    const mhItems: { label: string; rate: string; icon: string }[] = [];
    const mh = report.maharashtra;
    if (mh.extraBig?.display) mhItems.push({ label: 'EXTRA BIG (EB)', rate: mh.extraBig.display, icon: 'onion' });
    if (mh.big?.display) mhItems.push({ label: 'BIG QUALITY', rate: mh.big.display, icon: 'onion' });
    if (mh.mukkal?.display) mhItems.push({ label: 'MUKKAL (3/4)', rate: mh.mukkal.display, icon: 'onion' });
    if (mh.medium?.display) mhItems.push({ label: 'MEDIUM (MED)', rate: mh.medium.display, icon: 'onion' });
    if (mh.golta?.display) mhItems.push({ label: 'GOLTA ONION', rate: mh.golta.display, icon: 'onion' });
    if (mh.golty?.display) mhItems.push({ label: 'GOLTY ONION', rate: mh.golty.display, icon: 'onion' });
    if (mh.chopda?.display) mhItems.push({ label: 'CHOPDA', rate: mh.chopda.display, icon: 'onion' });
    if (mh.averageQuality?.display) mhItems.push({ label: 'AVERAGE QUALITY', rate: mh.averageQuality.display, icon: 'onion' });

    // Structure-driven sections, when the message produced them. The first
    // section fills the main table and the rest stack below it. Nothing in this
    // file matches a section name, so a heading the parser has never seen is
    // laid out exactly like a familiar one.
    const parsedSections = (report.sections || []).filter(s => s.title && (s.rows || []).length > 0);
    const useSections = parsedSections.length > 0;
    const mainSection = useSections ? parsedSections[0] : null;
    const stackedSections = useSections ? parsedSections.slice(1) : [];
    if (mainSection) {
      mhItems.length = 0;
      mainSection.rows.forEach(r => {
        if (r.rate?.display) mhItems.push({ label: r.label.toUpperCase(), rate: r.rate.display, icon: 'onion' });
      });
    }
    const mainTitle = mainSection ? mainSection.title : 'MAHARASHTRA ONIONS';

    // Card geometry, shared by the height maths and the drawing loop - they must
    // agree or the canvas is sized for a different poster than the one drawn.
    const SEC_HEADER_H = 52;
    const SEC_ROW_H = 65;
    const SEC_ROW_GAP = 4;
    const SEC_PAD = 10;
    const SEC_SALES_H = 34;
    const SECTION_PALETTE = [theme.vjHeaderColor, theme.newOnionHeaderColor, theme.mhHeaderColor, theme.vegHeaderColor];
    const sectionCardH = (section: { count?: string | null; rows: unknown[] }, isLast: boolean) =>
      SEC_HEADER_H +
      (section.rows.length + (section.count ? 1 : 0)) * (SEC_ROW_H + SEC_ROW_GAP) +
      SEC_PAD +
      (isLast ? SEC_SALES_H : 0);

    const commodities = (report.commodities || []).filter(c => c.name && (c.rate?.display || c.variety));
    const hasMhRates = mhItems.length > 0;
    const hasVJ = !!report.vijayapura?.rate?.display;
    const newOnionGrades = (report.newOnions?.grades || []).filter(g => g.label && g.rate?.display);
    const hasNewOnion = !!(report.newOnions?.rate?.display || report.newOnions?.bagCount || report.newOnions?.lotRate?.display || newOnionGrades.length > 0);
    const hasCommodities = commodities.length > 0;

    if (!hasMhRates && !hasVJ && !hasNewOnion && !hasCommodities) {
      mhItems.push({ label: 'REGULAR ONION', rate: '4000-4200', icon: 'onion' });
    }

    const weatherText = report.weather || 'Normal';
    // Same doubling guard as truckCount below: the label prepends "SALES", and
    // stored reports often already lead with it ("Sales slow" -> "SALES SALES SLOW").
    const salesText = (report.salesStatus || 'Steady').replace(/^\s*sales\s+/i, '').trim() || 'Steady';
    const arrivalsDisplay = report.totalArrivals?.display?.trim() || '';
    // Tolerate a truckCount that already carries its unit ("325+ Trucks"), which
    // older stored reports have — otherwise the appended word doubles up.
    const truckCountBare = report.truckCount?.replace(/\s*(?:trucks?|lorr(?:y|ies))\s*$/i, '').trim();
    const trucksDisplay = truckCountBare ? `${truckCountBare} Trucks` : '';
    // The bar exists only if there is something true to put in it.
    const hasArrivalsInfo = Boolean(arrivalsDisplay || trucksDisplay);

    const shopNameUpperEarly = settings.shopName.toUpperCase();
    const taglineUpperEarly = (settings.footerTagline || 'Onion Wholesale Merchants').toUpperCase();

    // Measure every string this poster draws before laying anything out, so the
    // synchronous geometry below works from real ink widths instead of guesses.
    // Anything missed here still gets a deliberately wide fallback estimate, so
    // an omission costs a slightly small font, never an overlap.
    await warmTextMetrics([
      ...mhItems.map(i => ({ text: labelDisplay(i.label), family: FONT_LABEL, weight: LABEL_WEIGHT })),
      ...mhItems.map(i => ({ text: i.rate, family: FONT_HEADING, weight: 400 })),
      ...commodities.map(c => ({ text: labelDisplay(c.name), family: FONT_LABEL, weight: LABEL_WEIGHT })),
      ...commodities.map(c => ({ text: [c.variety, c.unit].filter(Boolean).join(' • '), family: FONT_TABLE, weight: 700 })),
      ...commodities.map(c => ({ text: c.rate?.display || 'As Per Quality', family: FONT_HEADING, weight: 400 })),
      ...['RATES', '1-2 LOT', (report.newOnions?.state || 'KARNATAKA').toUpperCase()]
        .map(t => ({ text: labelDisplay(t), family: FONT_LABEL, weight: LABEL_WEIGHT })),
      ...[
        report.vijayapura?.rate?.display || '3000-3700',
        report.newOnions?.bagCount || '—',
        report.newOnions?.rate?.display || '1600-3400',
        report.newOnions?.lotRate?.display || '',
      ].map(t => ({ text: t, family: FONT_HEADING, weight: 400 })),
      ...parsedSections.map(sec => ({ text: sec.title, family: FONT_HEADING, weight: HEADING_WEIGHT })),
      ...parsedSections.flatMap(sec => sec.rows.map(r => ({ text: labelDisplay(r.label.toUpperCase()), family: FONT_LABEL, weight: LABEL_WEIGHT }))),
      ...parsedSections.flatMap(sec => sec.rows.map(r => ({ text: r.rate?.display || '', family: FONT_HEADING, weight: 400 }))),
      ...parsedSections.filter(sec => sec.count).map(sec => ({ text: sec.count as string, family: FONT_HEADING, weight: 400 })),
      ...[
        'MAHARASHTRA ONIONS', 'VIJAYAPURA ONIONS', 'NEW ONIONS',
        'VEGETABLE & COMMODITY RATES',
        `APMC ${marketShort}`, 'ONION MARKET REPORT', `Date. ${dateDisplay}`,
        'APMC WISE', 'ARRIVALS', arrivalsDisplay, trucksDisplay,
        `RATES FOR ${rateUnit.replace(/^Per\s*/i, '').toUpperCase()}`,
        weatherText.toUpperCase(),
        shopNameUpperEarly, getInitials(settings.shopName),
      ].map(t => ({ text: t, family: FONT_HEADING, weight: 400 })),
      { text: `SALES ${salesText.toUpperCase()}`, family: FONT_TABLE, weight: 700 },
      ...[
        taglineUpperEarly, 'BEST QUALITY', 'BEST RATES', 'TRUSTED SERVICE',
        settings.phone, settings.whatsapp, settings.apmcAddress,
        (settings.phoneContactName || '').toUpperCase(),
        (settings.whatsappContactName || '').toUpperCase(),
      ].map(t => ({ text: t, family: FONT_BRAND, weight: 800 })),
    ]);

    // ==================================================================
    // Left column: MAHARASHTRA ONIONS table
    // ==================================================================
    // Branding is deliberately small on this layout and its height is fixed, so
    // the rate tables — the reason anyone opens the image — get everything else.
    const hasPhoneContact = !!(settings.phoneContactName && settings.phoneContactName.trim());
    const hasWhatsappContact = !!(settings.whatsappContactName && settings.whatsappContactName.trim());
    const namesRowH = (hasPhoneContact || hasWhatsappContact) ? 28 : 0;
    const namesGap = namesRowH > 0 ? 6 : 0;
    const namesBlockH = namesRowH + namesGap;
    // Heights of the two stacked bars at the foot of the branding card. They
    // are needed here, where the card's total height is reserved, and again
    // when it is drawn — declared once, up front.
    const CONTACT_BAR_H = 76;
    const ADDRESS_BAR_H = 84;
    const BRAND_TOP_H = 138;
    const bottomBlockH = namesBlockH + CONTACT_BAR_H + 12 + ADDRESS_BAR_H;
    const bottomPad = 12;
    const brandingH = BRAND_TOP_H + bottomBlockH + bottomPad;

    const TABLES_TOP = hasArrivalsInfo ? 456 : 300;
    const LEFT_X = 36;
    const LEFT_W = 1008;
    const RIGHT_X = LEFT_X;
    const RIGHT_W = LEFT_W;

    const mhBaseRowH = mhItems.length > 7 ? 62 : (mhItems.length > 5 ? 75 : 88);
    const mhHeaderH = 50;
    const mhFooterH = 45;
    // 9:16 leaves room the 4:5 layout never had. Rather than bank it as empty
    // paper above the branding card, the grade rows grow into it — the tallest
    // type on the poster gets the tallest rows. Capped so a short report does
    // not turn into a few enormous bands.
    const MH_ROW_MIN = 56;
    // Must match the rows built below exactly, or the canvas is sized for a
    // different table than the one that gets drawn.
    const noRowCount =
      (report.newOnions?.state || report.newOnions?.bagCount ? 1 : 0) +
      (newOnionGrades.length > 0 ? newOnionGrades.length : 1) +
      (report.newOnions?.lotRate?.display ? 1 : 0);
    const vegRowHEarly = commodities.length > 6 ? 62 : 75;
    const sectionsStackedH = stackedSections.reduce(
      (sum, sec, i) => sum + sectionCardH(sec, i === stackedSections.length - 1) + 8,
      0
    );
    const stackedBelowH =
      (useSections ? sectionsStackedH : 0) +
      (!useSections && hasVJ ? 52 + 72 + 10 + 8 : 0) +
      (!useSections && hasNewOnion ? 52 + noRowCount * (65 + 4) + 10 + 34 + 8 : 0) +
      (72 + 12) +
      (hasCommodities ? 55 + commodities.length * (vegRowHEarly + 4) + 10 + 12 : 0);
    // What the poster needs if every stretchable row sits at its floor. Only
    // this decides the canvas height; everything after it is positioning.
    const mhFloorTableH = hasMhRates ? mhHeaderH + mhItems.length * (MH_ROW_MIN + 2) + 10 + mhFooterH + 12 : 0;
    const contentNeedsH = TABLES_TOP + mhFloorTableH + stackedBelowH + brandingH + 24;
    const CANVAS_H = Math.max(CANVAS_H_MIN, Math.ceil(contentNeedsH));
    const brandingTop = CANVAS_H - 24 - brandingH;
    const tablesAvailH = brandingTop - 12 - TABLES_TOP - stackedBelowH;
    const mhFillRowH =
      hasMhRates && mhItems.length > 0
        ? Math.floor((tablesAvailH - mhHeaderH - mhFooterH - 10) / mhItems.length) - 2
        : mhBaseRowH;
    const mhRowHeight = Math.max(MH_ROW_MIN, Math.min(mhFillRowH, Math.round(mhBaseRowH * 2.4)));
    const mhInteriorW = LEFT_W - 32;
    const mhTableH = hasMhRates ? mhHeaderH + mhItems.length * (mhRowHeight + 2) + 10 + mhFooterH : 0;

    let mhRowsSvg = '';
    const mhTableRows = mhItems.map(i => ({ label: i.label, value: i.rate }));
    const mhDividerX = tableDividerX(mhTableRows, mhInteriorW, mhRowHeight);
    const mhSizes = tableTypeSizes(mhTableRows, mhInteriorW, mhRowHeight, mhDividerX);
    mhItems.forEach((item, i) => {
      const y = mhHeaderH + 8 + i * (mhRowHeight + 2);
      mhRowsSvg += heritageRow(16, y, mhInteriorW, mhRowHeight, item.icon, item.label, null, item.rate, i % 2 === 1, mhDividerX, mhSizes);
    });

    const mhSectionSvg = hasMhRates ? `
      <g id="mh-table" transform="translate(${LEFT_X}, ${TABLES_TOP})">
        <rect x="0" y="0" width="${LEFT_W}" height="${mhTableH}" rx="18" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2" />
        ${sectionHeader(0, 0, LEFT_W, mhHeaderH, theme.mhHeaderColor, mainTitle, 'onion')}
        ${mhRowsSvg}
        <rect x="0" y="${mhTableH - mhFooterH}" width="${LEFT_W}" height="${mhFooterH}" rx="12" fill="${theme.footerBarColor}" />
        <rect x="0" y="${mhTableH - mhFooterH}" width="${LEFT_W}" height="${mhFooterH / 2}" fill="${theme.footerBarColor}" />
        <text x="${LEFT_W / 2}" y="${mhTableH - mhFooterH / 2 + 9}" font-family="${FONT_HEADING}" font-size="30" font-weight="${HEADING_WEIGHT}" fill="#ffffff" text-anchor="middle" letter-spacing="0.2">RATES FOR ${escapeXml(rateUnit.replace(/^Per\s*/i, '').toUpperCase())}</text>
      </g>
    ` : '';
    const leftBottomY = TABLES_TOP + (hasMhRates ? mhTableH : 0);

    // ==================================================================
    // Right column: Vijayapura + New Onions + Weather
    // ==================================================================
    let rightCursorY = TABLES_TOP + (hasMhRates ? mhTableH + 12 : 0);
    let rightColSvg = '';
    const rightInteriorW = RIGHT_W - 32;

    // Structure-driven cards. Each stacked section is drawn the same way, its
    // colour taken from a palette by position, so a heading nobody anticipated
    // renders exactly like a familiar one - no name appears in this code.
    if (useSections) {
      stackedSections.forEach((section, si) => {
        const isLast = si === stackedSections.length - 1;
        const rows: { label: string; value: string }[] = [];
        // Labelled 'ARRIVALS', not with the section's own title - the card
        // header already says which section this is.
        if (section.count) rows.push({ label: 'ARRIVALS', value: section.count });
        section.rows.forEach(r => {
          if (r.rate?.display) rows.push({ label: r.label.toUpperCase(), value: r.rate.display });
        });
        if (rows.length === 0) return;

        const cardH = sectionCardH(section, isLast);
        const salesLabel = `SALES ${salesText.toUpperCase()}`;
        const salesSize = fitSize(salesLabel, FONT_TABLE, 700, 32, 20, RIGHT_W - 32);
        const dividerX = tableDividerX(rows, rightInteriorW, SEC_ROW_H);
        const sizes = tableTypeSizes(rows, rightInteriorW, SEC_ROW_H, dividerX);

        let rowsSvg = '';
        rows.forEach((r, i) => {
          const y = SEC_HEADER_H + 8 + i * (SEC_ROW_H + SEC_ROW_GAP);
          rowsSvg += heritageRow(16, y, rightInteriorW, SEC_ROW_H, 'onion', r.label, null, r.value, i % 2 === 1, dividerX, sizes);
        });

        rightColSvg += `
        <g id="section-card-${si}" transform="translate(${RIGHT_X}, ${rightCursorY})">
          <rect x="0" y="0" width="${RIGHT_W}" height="${cardH}" rx="16" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2" />
          ${sectionHeader(0, 0, RIGHT_W, SEC_HEADER_H, SECTION_PALETTE[si % SECTION_PALETTE.length], section.title, 'sprout')}
          ${rowsSvg}
          ${isLast ? `<text x="16" y="${cardH - 11}" font-family="${FONT_TABLE}" font-size="${salesSize}" font-weight="700" fill="${RATE_TEXT_COLOR}" letter-spacing="0.2">${escapeXml(salesLabel)}</text>` : ''}
        </g>
      `;
        rightCursorY += cardH + 8;
      });
    }

    if (!useSections && hasVJ) {
      const vjHeaderH = 52;
      const vjRowH = 72;
      const vjH = vjHeaderH + vjRowH + 10;
      const vjRate = report.vijayapura?.rate?.display || '3000-3700';
      const vjDividerX = tableDividerX([{ label: 'RATES', value: vjRate }], rightInteriorW, vjRowH);
      rightColSvg += `
        <g id="vj-card" transform="translate(${RIGHT_X}, ${rightCursorY})">
          <rect x="0" y="0" width="${RIGHT_W}" height="${vjH}" rx="16" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2" />
          ${sectionHeader(0, 0, RIGHT_W, vjHeaderH, theme.vjHeaderColor, 'VIJAYAPURA ONIONS', 'wheat')}
          ${heritageRow(16, vjHeaderH + 8, rightInteriorW, vjRowH, 'onion', 'RATES', null, vjRate, false, vjDividerX)}
        </g>
      `;
      rightCursorY += vjH + 8;
    }

    if (!useSections && hasNewOnion) {
      const noHeaderH = 52;
      const noRows: { label: string; value: string }[] = [];
      if (report.newOnions?.state || report.newOnions?.bagCount) {
        noRows.push({ label: (report.newOnions?.state || 'KARNATAKA').toUpperCase(), value: report.newOnions?.bagCount || '—' });
      }
      // Per-grade rows when the message quoted them, otherwise the single
      // RATES row the older one-rate reports carry.
      if (newOnionGrades.length > 0) {
        newOnionGrades.forEach(g => noRows.push({ label: g.label.toUpperCase(), value: g.rate!.display }));
      } else {
        noRows.push({ label: 'RATES', value: report.newOnions?.rate?.display || '1600-3400' });
      }
      if (report.newOnions?.lotRate?.display) {
        noRows.push({ label: '1-2 LOT', value: report.newOnions.lotRate.display });
      }
      const noRowH = 65;
      const salesH = 34;
      const salesGap = 10;
      const noH = noHeaderH + noRows.length * (noRowH + 4) + salesGap + salesH;
      const salesLabel = `SALES ${salesText.toUpperCase()}`;
      const salesSize = fitSize(salesLabel, FONT_TABLE, 700, 32, 20, RIGHT_W - 32);

      let noRowsSvg = '';
      const noDividerX = tableDividerX(noRows, rightInteriorW, noRowH);
      const noSizes = tableTypeSizes(noRows, rightInteriorW, noRowH, noDividerX);
      noRows.forEach((r, i) => {
        const y = noHeaderH + 8 + i * (noRowH + 4);
        noRowsSvg += heritageRow(16, y, rightInteriorW, noRowH, 'onion', r.label, null, r.value, i % 2 === 1, noDividerX, noSizes);
      });

      rightColSvg += `
        <g id="no-card" transform="translate(${RIGHT_X}, ${rightCursorY})">
          <rect x="0" y="0" width="${RIGHT_W}" height="${noH}" rx="16" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2" />
          ${sectionHeader(0, 0, RIGHT_W, noHeaderH, theme.newOnionHeaderColor, 'NEW ONIONS', 'sprout')}
          ${noRowsSvg}
          <text x="16" y="${noH - 11}" font-family="${FONT_TABLE}" font-size="${salesSize}" font-weight="700" fill="${RATE_TEXT_COLOR}" letter-spacing="0.2">${escapeXml(salesLabel)}</text>
        </g>
      `;
      rightCursorY += noH + 8;
    }

    // Weather bar
    const weatherH = 72;
    rightColSvg += `
      <g id="weather-bar" transform="translate(${RIGHT_X}, ${rightCursorY})">
        <rect x="0" y="0" width="${RIGHT_W}" height="${weatherH}" rx="14" fill="${theme.weatherBarColor}" />
        ${renderIcon(getWeatherIcon(weatherText), RIGHT_W / 2 - widthOf(weatherText.toUpperCase(), FONT_HEADING, HEADING_WEIGHT, 28) / 2 - 40, weatherH / 2 - 15, 30, '#ffffff')}
        <text x="${RIGHT_W / 2 + 19}" y="${weatherH / 2 + 10}" font-family="${FONT_HEADING}" font-size="35" font-weight="${HEADING_WEIGHT}" fill="#ffffff" text-anchor="middle" letter-spacing="0.1">${escapeXml(weatherText.toUpperCase())}</text>
      </g>
    `;
    rightCursorY += weatherH;

    const columnsBottomY = Math.max(leftBottomY, rightCursorY);

    // ==================================================================
    // Vegetables / other commodities (full width, below both columns)
    // ==================================================================
    let vegSectionSvg = '';
    let afterVegY = columnsBottomY;
    if (hasCommodities) {
      const vegY = columnsBottomY + 12;
      const vegHeaderH = 55;
      const vegRowH = commodities.length > 6 ? 62 : 75;
      const vegInteriorW = 1008 - 32;
      const vegTableH = vegHeaderH + commodities.length * (vegRowH + 4) + 10;

      let vegRowsSvg = '';
      const vegDividerX = tableDividerX(
        commodities.map(c => ({ label: c.name, value: c.rate?.display ? c.rate.display : 'As Per Quality' })),
        vegInteriorW, vegRowH
      );
      commodities.forEach((c, i) => {
        const y = vegHeaderH + 8 + i * (vegRowH + 4);
        const displayRate = c.rate?.display ? c.rate.display : 'As Per Quality';
        const subLabel = [c.variety, c.unit].filter(Boolean).join(' • ') || null;
        vegRowsSvg += heritageRow(16, y, vegInteriorW, vegRowH, getCommodityIcon(c.name), c.name, subLabel, displayRate, i % 2 === 1, vegDividerX);
      });

      vegSectionSvg = `
        <g id="veg-table" transform="translate(${LEFT_X}, ${vegY})">
          <rect x="0" y="0" width="1008" height="${vegTableH}" rx="18" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2" />
          ${sectionHeader(0, 0, 1008, vegHeaderH, theme.vegHeaderColor, 'VEGETABLE & COMMODITY RATES', 'cabbage')}
          ${vegRowsSvg}
        </g>
      `;
      afterVegY = vegY + vegTableH;
    }

    // ==================================================================
    // Footer: shop branding block
    // ==================================================================
    // Fixed heights of the footer's top block (logo/name/tagline/badges), the
    // contact-person name tags, and the bottom block (contact bar + address) —
    // used both to size the footer card and to guarantee it never gets pushed
    // off the bottom of the canvas.
    const topBlockBottom = BRAND_TOP_H;
    // The card sits at the bottom at its reserved height. A report long enough
    // to reach it pushes it down instead of overlapping — a snug card beats
    // rates printed underneath a phone number.
    const footerY = brandingTop;
    const footerH = brandingH;

    // Logo badge geometry, shared by the SVG ring below and the sharp composite
    // near the end of this function. Both must agree or the photo sits off its
    // ring; keep them reading from here rather than repeating the numbers.
    const LOGO_CX = 86;
    const LOGO_CY = 58;
    const LOGO_R = 42;

    // The phone numbers are what a trader acts on after reading the rates, so
    // they are sized as content rather than as fine print.
    // The address is how a new buyer finds the shop, so it is sized to fill its
    // bar rather than to fit politely inside it.
    const addressSize = fitSize(settings.apmcAddress, FONT_BRAND, 800, 28, 14, 900);
    const contactNumberSize = (value: string) => fitSize(value, FONT_BRAND, 800, 38, 20, 380);

    // Arrivals bar. With both figures it reads as two lines; with one, that
    // line takes the middle of the bar instead of leaving a gap where the
    // missing figure would have been.
    const arrivalsBarSvg = !hasArrivalsInfo
      ? ''
      : `
      <g id="arrivals-bar" transform="translate(36, 292)" filter="url(#softShadow)">
        <rect x="0" y="0" width="1008" height="140" rx="16" fill="${theme.arrivalsBarColor}" />
        <text x="24" y="54" font-family="${FONT_HEADING}" font-size="34" font-weight="${HEADING_WEIGHT}" fill="#ffffff" letter-spacing="0.1">APMC WISE</text>
        <text x="24" y="96" font-family="${FONT_HEADING}" font-size="34" font-weight="${HEADING_WEIGHT}" fill="#ffffff" letter-spacing="0.1">ARRIVALS</text>
        <line x1="360" y1="16" x2="360" y2="124" stroke="rgba(255,255,255,0.35)" stroke-width="2" />
        ${
          arrivalsDisplay && trucksDisplay
            ? `<text x="392" y="60" font-family="${FONT_HEADING}" font-size="50" font-weight="${HEADING_WEIGHT}" fill="#fde047">${escapeXml(arrivalsDisplay)}</text>
        <text x="392" y="116" font-family="${FONT_HEADING}" font-size="45" font-weight="${HEADING_WEIGHT}" fill="#fde047">${escapeXml(trucksDisplay)}</text>`
            : `<text x="392" y="88" font-family="${FONT_HEADING}" font-size="50" font-weight="${HEADING_WEIGHT}" fill="#fde047">${escapeXml(arrivalsDisplay || trucksDisplay)}</text>`
        }
        ${trucksDisplay && !hasTruckPhoto ? renderIcon('truck', 912, 38, 72, '#ffffff') : ''}
      </g>`;

    const initials = getInitials(settings.shopName);
    const shopNameUpper = settings.shopName.toUpperCase();
    // Banner is 764 wide starting at x=204; keep 24px of plaque either side.
    const shopHeaderFontSize = fitSize(shopNameUpper, FONT_HEADING, HEADING_WEIGHT, 42, 20, 716);

    const taglineUpper = (settings.footerTagline || 'Onion Wholesale Merchants').toUpperCase();
    const taglineFontSize = fitSize(taglineUpper, FONT_BRAND, 800, 17, 11, 726);

    // Anchor the name tags + contact bar + address to the bottom of the card, so
    // short reports (tall leftover card space) don't leave a dead gap below the
    // address bar. footerH is guaranteed >= minFooterH above, so this never
    // overflows the card.
    const contactY = Math.max(topBlockBottom + 20 + namesBlockH, footerH - bottomBlockH - bottomPad);
    const namesY = contactY - namesBlockH;
    const addressY = contactY + 88;
    const useWarehousePhoto = hasWarehousePhoto && (namesY - (topBlockBottom + 20)) >= 40;
    const warehouseBandTop = topBlockBottom + 20;
    const warehouseBandH = Math.max(0, namesY - 10 - warehouseBandTop);

    // Contact-person name tags, positioned directly above their matching number in the bar below.
    const namesRowSvg = namesRowH > 0 ? `
      <g transform="translate(24, ${namesY})">
        ${hasPhoneContact ? `
        <rect x="140" y="0" width="200" height="${namesRowH}" rx="${namesRowH / 2}" fill="${theme.arrivalsBarColor}" />
        <text x="240" y="${namesRowH / 2 + 7}" font-family="${FONT_BRAND}" font-size="17" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.3">${escapeXml((settings.phoneContactName || '').toUpperCase())}</text>
        ` : ''}
        ${hasWhatsappContact ? `
        <rect x="620" y="0" width="200" height="${namesRowH}" rx="${namesRowH / 2}" fill="${theme.shopNameColor}" />
        <text x="720" y="${namesRowH / 2 + 7}" font-family="${FONT_BRAND}" font-size="17" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.3">${escapeXml((settings.whatsappContactName || '').toUpperCase())}</text>
        ` : ''}
      </g>
    ` : '';

    // The onion clusters sit in x<=206 and x>=874 across the whole title band,
    // so the centred headline has to stay inside the gap between them.
    const TITLE_MAX_W = 644;
    const titleFull = `APMC ${marketShort}`;
    const titleFontSize = fitSize(titleFull, FONT_HEADING, HEADING_WEIGHT, 64, 34, TITLE_MAX_W);
    const titleText = truncateToWidth(titleFull, FONT_HEADING, HEADING_WEIGHT, titleFontSize, TITLE_MAX_W);
    const subtitleFontSize = fitSize('ONION MARKET REPORT', FONT_HEADING, HEADING_WEIGHT, 40, 24, TITLE_MAX_W);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" width="${CANVAS_W}" height="${CANVAS_H}">
      <defs>
        <linearGradient id="paperGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${theme.paperBgStart}" />
          <stop offset="100%" stop-color="${theme.paperBgEnd}" />
        </linearGradient>
        <linearGradient id="contactGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${theme.arrivalsBarColor}" />
          <stop offset="100%" stop-color="${theme.shopNameColor}" />
        </linearGradient>
        <linearGradient id="shopBannerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${theme.shopNameColor}" />
          <stop offset="50%" stop-color="${theme.arrivalsBarColor}" />
          <stop offset="100%" stop-color="${theme.shopNameColor}" />
        </linearGradient>
        <filter id="softShadow" x="-5%" y="-10%" width="110%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.25" />
        </filter>
      </defs>

      <!-- Paper background -->
      <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#paperGrad)" />

      <!-- Outer frame -->
      <rect x="14" y="14" width="${CANVAS_W - 28}" height="${CANVAS_H - 28}" rx="24" fill="none" stroke="${theme.frameColor}" stroke-width="8" />
      <rect x="28" y="28" width="${CANVAS_W - 56}" height="${CANVAS_H - 56}" rx="16" fill="none" stroke="${theme.frameColor}" stroke-width="2" opacity="0.5" />

      <!-- ============================ -->
      <!-- 1. TITLE HEADER               -->
      <!-- ============================ -->
      <g id="title-header" transform="translate(0, 40)">
        <!-- Onion cluster decorations (vector fallback; skipped when onion.png photo is composited) -->
        ${hasOnionPhoto ? '' : `
        <g transform="translate(64, 58)">
          <g transform="rotate(-12)">${renderIcon('onion', -50, -34, 68)}</g>
          <g transform="rotate(10)">${renderIcon('onion', 11, 5, 46)}</g>
        </g>
        <g transform="translate(1016, 58)">
          <g transform="rotate(12)">${renderIcon('onion', -18, -34, 68)}</g>
          <g transform="rotate(-10)">${renderIcon('onion', -57, 5, 46)}</g>
        </g>
        `}

        <text x="540" y="62" font-family="${FONT_HEADING}" font-size="${titleFontSize}" font-weight="${HEADING_WEIGHT}" fill="${theme.titleColor}" text-anchor="middle" letter-spacing="0.3" stroke="#ffffff" stroke-width="2.5" paint-order="stroke">${escapeXml(titleText)}</text>
        <text x="540" y="104" font-family="${FONT_HEADING}" font-size="${subtitleFontSize}" font-weight="${HEADING_WEIGHT}" fill="${theme.subtitleColor}" text-anchor="middle" letter-spacing="0.3">ONION MARKET REPORT</text>
      </g>

      <!-- ============================ -->
      <!-- 2. DATE BADGE                 -->
      <!-- ============================ -->
      <g id="date-badge" transform="translate(36, 196)" filter="url(#softShadow)">
        <rect x="0" y="0" width="1008" height="80" rx="16" fill="${theme.dateBadgeColor}" />
        <rect x="180" y="8" width="648" height="64" rx="14" fill="${RATE_BG_COLOR}" stroke="${RATE_BORDER_COLOR}" stroke-width="2.5" />
        ${renderIcon('calendar', 210, 24, 34)}
        <text x="262" y="55" font-family="${FONT_HEADING}" font-size="40" font-weight="${HEADING_WEIGHT}" fill="${RATE_TEXT_COLOR}" letter-spacing="0.2">Date. ${escapeXml(dateDisplay)}</text>
      </g>

      <!-- ============================ -->
      <!-- 3. ARRIVALS BAR (omitted when the report states neither figure) -->
      <!-- ============================ -->
      ${arrivalsBarSvg}

      <!-- ============================ -->
      <!-- 4. MAHARASHTRA ONIONS TABLE   -->
      <!-- ============================ -->
      ${mhSectionSvg}

      <!-- 5. VIJAYAPURA + NEW ONIONS + WEATHER -->
      ${rightColSvg}

      <!-- 6. VEGETABLE / COMMODITY TABLE -->
      ${vegSectionSvg}

      <!-- ============================ -->
      <!-- 7. SHOP BRANDING FOOTER        -->
      <!-- ============================ -->
      <g id="shop-footer" transform="translate(36, ${footerY})">
        <rect x="0" y="0" width="1008" height="${footerH}" rx="20" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2.5" filter="url(#softShadow)" />

        <!-- Logo monogram (ring always drawn; photo logo composited on top when logo.png is present) -->
        <circle cx="${LOGO_CX}" cy="${LOGO_CY}" r="${LOGO_R}" fill="#fffdf6" stroke="${theme.shopNameColor}" stroke-width="3" />
        ${hasLogoPhoto ? '' : `
        <text x="${LOGO_CX}" y="${LOGO_CY + 11}" font-family="${FONT_HEADING}" font-size="27" font-weight="${HEADING_WEIGHT}" fill="${theme.shopNameColor}" text-anchor="middle">${escapeXml(initials)}</text>
        `}

        <!-- Shop name banner (colored plaque, not plain text-on-white, so it reads as the poster's focal point) -->
        <rect x="176" y="10" width="792" height="46" rx="14" fill="url(#shopBannerGrad)" />
        <text x="572" y="47" font-family="${FONT_HEADING}" font-size="${shopHeaderFontSize}" font-weight="${HEADING_WEIGHT}" fill="#fde047" text-anchor="middle" letter-spacing="0.6" stroke="#fde047" stroke-width="2.8" paint-order="stroke" stroke-linejoin="round">${escapeXml(shopNameUpper)}</text>
        <rect x="176" y="62" width="792" height="30" rx="15" fill="${theme.pillA}" />
        <text x="572" y="83" font-family="${FONT_BRAND}" font-size="${taglineFontSize}" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.2" stroke="#ffffff" stroke-width="0.7" paint-order="stroke" stroke-linejoin="round">${escapeXml(taglineUpper)}</text>

        <!-- Feature pills -->
        <g transform="translate(76, 100)">
          <rect x="0" y="0" width="270" height="34" rx="17" fill="${theme.pillA}" />
          <text x="135" y="23" font-family="${FONT_BRAND}" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.2" stroke="#ffffff" stroke-width="0.6" paint-order="stroke" stroke-linejoin="round">BEST QUALITY</text>
          <rect x="292" y="0" width="270" height="34" rx="17" fill="${theme.pillB}" />
          <text x="427" y="23" font-family="${FONT_BRAND}" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.2" stroke="#ffffff" stroke-width="0.6" paint-order="stroke" stroke-linejoin="round">BEST RATES</text>
          <rect x="584" y="0" width="270" height="34" rx="17" fill="${theme.pillA}" />
          <text x="719" y="23" font-family="${FONT_BRAND}" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.2" stroke="#ffffff" stroke-width="0.6" paint-order="stroke" stroke-linejoin="round">TRUSTED SERVICE</text>
        </g>

        <!-- Contact-person name tags (above the matching number below) -->
        ${namesRowSvg}

        <!-- Contact bar -->
        <g transform="translate(24, ${contactY})">
          <rect x="0" y="0" width="960" height="${CONTACT_BAR_H}" rx="${CONTACT_BAR_H / 2}" fill="url(#contactGrad)" />
          <line x1="480" y1="12" x2="480" y2="${CONTACT_BAR_H - 12}" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
          ${renderIcon('phone', 240 - widthOf(settings.phone, FONT_BRAND, 800, contactNumberSize(settings.phone)) / 2 - 46, CONTACT_BAR_H / 2 - 16, 32, '#ffffff')}
          <text x="${240 + 21}" y="${CONTACT_BAR_H / 2 + contactNumberSize(settings.phone) * 0.35}" font-family="${FONT_BRAND}" font-size="${contactNumberSize(settings.phone)}" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(settings.phone)}</text>
          ${renderIcon('chat', 720 - widthOf(settings.whatsapp, FONT_BRAND, 800, contactNumberSize(settings.whatsapp)) / 2 - 46, CONTACT_BAR_H / 2 - 16, 32, '#ffffff')}
          <text x="${720 + 21}" y="${CONTACT_BAR_H / 2 + contactNumberSize(settings.whatsapp) * 0.35}" font-family="${FONT_BRAND}" font-size="${contactNumberSize(settings.whatsapp)}" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(settings.whatsapp)}</text>
        </g>

        <!-- Address -->
        <g transform="translate(24, ${addressY})">
          <rect x="0" y="0" width="960" height="${ADDRESS_BAR_H}" rx="16" fill="${theme.addressBg}" stroke="${theme.addressBorder}" stroke-width="2" />
          ${renderIcon('pin', 470, 9, 22)}
          <text x="480" y="${ADDRESS_BAR_H - 22}" font-family="${FONT_BRAND}" font-size="${addressSize}" font-weight="800" fill="${theme.addressText}" text-anchor="middle">${escapeXml(settings.apmcAddress)}</text>
        </g>
      </g>
    </svg>
    `;

    const fileName = `onion-report-${dateDisplay.replace(/\./g, '-')}-${uuidv4().substring(0, 8)}.png`;
    const absolutePath = path.join(POSTERS_DIR, fileName);
    const urlPath = `/posters/${fileName}`;

    // ==================================================================
    // Composite licensed photo assets (if present) on top of the base render
    // ==================================================================
    const compositeOps: sharp.OverlayOptions[] = [];

    if (hasOnionPhoto) {
      const ONION_W = 200;
      const ONION_H = Math.round((ONION_W * 1024) / 1536);
      const onionBuf = await sharp(ONION_PHOTO).resize(ONION_W, ONION_H, { fit: 'contain' }).toBuffer();
      const onionBufFlipped = await sharp(ONION_PHOTO).flop().resize(ONION_W, ONION_H, { fit: 'contain' }).toBuffer();
      compositeOps.push({ input: onionBuf, left: 6, top: 16 });
      compositeOps.push({ input: onionBufFlipped, left: CANVAS_W - ONION_W - 6, top: 16 });
    }

    // The lorry is truck imagery, so it follows the truck count rather than
    // the bar as a whole: no truck figure reported, no truck on the poster.
    if (hasTruckPhoto && trucksDisplay) {
      const TRUCK_W = 300;
      const TRUCK_H = Math.round((TRUCK_W * 1024) / 1536);
      const truckBuf = await sharp(TRUCK_PHOTO).resize(TRUCK_W, TRUCK_H, { fit: 'contain' }).toBuffer();
      // 152 clears the "ONION MARKET REPORT" subtitle (ink ends at y=144);
      // the truck still overlaps the date/arrivals bars, which is intended.
      compositeOps.push({ input: truckBuf, left: 1044 - TRUCK_W - 10, top: 152 });
    }

    if (useWarehousePhoto) {
      const bandBuf = await sharp(WAREHOUSE_PHOTO)
        .resize(1008, Math.round(warehouseBandH), { fit: 'cover', position: 'centre' })
        .toBuffer();
      compositeOps.push({ input: bandBuf, left: 36, top: footerY + warehouseBandTop });
    }

    if (hasLogoPhoto) {
      const LOGO_SIZE = LOGO_R * 2;
      const circleMaskSvg = Buffer.from(
        `<svg width="${LOGO_SIZE}" height="${LOGO_SIZE}"><circle cx="${LOGO_SIZE / 2}" cy="${LOGO_SIZE / 2}" r="${LOGO_SIZE / 2}" fill="#fff"/></svg>`
      );
      const logoMeta = await sharp(LOGO_PHOTO).metadata();
      const logoW = logoMeta.width || 1000;
      const logoH = logoMeta.height || 1000;
      const cropSize = Math.round(Math.min(logoW, logoH) * 0.6);
      const cropLeft = Math.round((logoW - cropSize) / 2);
      const cropTop = Math.round(logoH * 0.06);
      const croppedResized = await sharp(LOGO_PHOTO)
        .extract({ left: cropLeft, top: cropTop, width: cropSize, height: cropSize })
        .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'cover' })
        .toBuffer();
      const circularLogo = await sharp(croppedResized)
        .composite([{ input: circleMaskSvg, blend: 'dest-in' }])
        .png()
        .toBuffer();
      // 36 is the footer group's x offset, footerY its y offset.
      const logoAbsX = 36 + LOGO_CX;
      const logoAbsY = footerY + LOGO_CY;
      compositeOps.push({ input: circularLogo, left: Math.round(logoAbsX - LOGO_SIZE / 2), top: Math.round(logoAbsY - LOGO_SIZE / 2) });
    }

    const svgBuffer = Buffer.from(svg);
    let pipeline = sharp(svgBuffer).resize(CANVAS_W, CANVAS_H);
    if (compositeOps.length > 0) {
      pipeline = pipeline.composite(compositeOps);
    }
    await pipeline
      .png({ quality: 95, compressionLevel: 8 })
      .toFile(absolutePath);

    return {
      fileName,
      absolutePath,
      urlPath
    };
  }
}
