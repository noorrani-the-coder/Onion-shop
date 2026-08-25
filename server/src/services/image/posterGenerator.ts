import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { MarketReportNormalized, ShopSettings } from '../../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { ASSETS_DIR as SERVER_ASSETS_DIR, PUBLIC_DIR as SERVER_PUBLIC_DIR } from '../../paths';
import { warmTextMetrics, widthOf, fitSize, truncateToWidth } from './textMetrics';

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

// Font roles (installed per-user from server/assets/fonts — see that folder's README):
//   Main headings & numbers/prices -> Anton
//   Table text                     -> Roboto Condensed Bold
//   Small branding text            -> Montserrat ExtraBold
const FONT_HEADING = "'Anton', 'Arial Black', Impact, sans-serif";
const FONT_TABLE = "'Roboto Condensed', 'Segoe UI', Arial, sans-serif";
const FONT_BRAND = "'Montserrat', 'Segoe UI', Arial, sans-serif";

// Instagram feed-post portrait canvas (4:5 — the tallest ratio Instagram's feed supports
// without auto-cropping; 2:3 or 9:16 get cropped when posted to the main feed).
const CANVAS_W = 1080;
const CANVAS_H = 1350;

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

function getCommodityIcon(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('ONION') || n.includes('EB') || n.includes('BIG') || n.includes('GOLTA') || n.includes('CHOPDA') || n.includes('MUKKAL') || n.includes('MEDIUM')) return '🧅';
  if (n.includes('POTATO') || n.includes('AALU') || n.includes('ALOO')) return '🥔';
  if (n.includes('GARLIC') || n.includes('LEHSUN') || n.includes('BELLULLI')) return '🧄';
  if (n.includes('GINGER') || n.includes('ADRAK') || n.includes('SHUNTHI')) return '🫚';
  if (n.includes('TOMATO')) return '🍅';
  if (n.includes('CHILLI') || n.includes('MIRCHI')) return '🌶️';
  if (n.includes('LEMON') || n.includes('NIMBU')) return '🍋';
  if (n.includes('CARROT') || n.includes('GAJAR')) return '🥕';
  if (n.includes('CABBAGE')) return '🥬';
  return '📦';
}

function getWeatherIcon(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('rain') || t.includes('storm')) return '🌧️';
  if (t.includes('sun') || t.includes('clear') || t.includes('hot')) return '☀️';
  if (t.includes('cold') || t.includes('cool')) return '❄️';
  return '☁️';
}

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
  return height > 60 ? 34 : 29;
}

const MIN_LABEL_SIZE = 20;
const MIN_VALUE_SIZE = 18;

/**
 * One divider position for a whole table, so every rate pill in it starts at the
 * same x and the column reads straight.
 *
 * It starts at the design's default split and slides right until the longest
 * label in the table has room — but never past the point where the widest rate
 * would stop fitting its pill at the smallest allowed size. Labels that still
 * do not fit shrink (and only then truncate) inside whatever room is left, which
 * is what makes a label/pill collision geometrically impossible.
 */
function tableDividerX(rows: { label: string; value: string }[], width: number, height: number): number {
  const labelStartX = rowLabelStartX(height);
  const baseLabelSize = rowBaseLabelSize(height);
  const dividerFloor = labelStartX + 40;

  const ceilings = rows.map(r => width - PILL_GAP - (widthOf(r.value, FONT_HEADING, 400, MIN_VALUE_SIZE) + PILL_PAD * 2));
  const dividerCeil = Math.max(dividerFloor, Math.min(...ceilings));

  const wants = Math.max(
    width * 0.56,
    ...rows.map(r => labelStartX + widthOf(r.label, FONT_TABLE, 700, baseLabelSize) + LABEL_GAP)
  );
  return Math.min(wants, dividerCeil);
}

// Renders one bold-label / bold-rate row: label to the left, a divider, a bold rate pill to the right.
// `dividerX` comes from tableDividerX so all rows of a table share one pill column.
function heritageRow(x: number, y: number, width: number, height: number, icon: string, label: string, sublabel: string | null, value: string, isAlt: boolean, dividerX: number): string {
  const rowBg = isAlt ? ROW_BG_B : ROW_BG_A;
  const iconBoxSize = height - 14;
  const labelStartX = rowLabelStartX(height);

  const baseLabelSize = rowBaseLabelSize(height);
  const baseValueSize = height > 60 ? 33 : 28;
  const minLabelSize = MIN_LABEL_SIZE;
  const minValueSize = MIN_VALUE_SIZE;

  const labelAvailW = dividerX - LABEL_GAP - labelStartX;
  const labelFontSize = fitSize(label, FONT_TABLE, 700, baseLabelSize, minLabelSize, labelAvailW);
  const labelText = truncateToWidth(label, FONT_TABLE, 700, labelFontSize, labelAvailW);

  const rateWidth = width - dividerX - PILL_GAP;
  const valueAvailW = rateWidth - PILL_PAD * 2;
  const valueFontSize = fitSize(value, FONT_HEADING, 400, baseValueSize, minValueSize, valueAvailW);
  const valueText = truncateToWidth(value, FONT_HEADING, 400, valueFontSize, valueAvailW);

  const subFontSize = 16;
  const subText = sublabel ? truncateToWidth(sublabel, FONT_TABLE, 700, subFontSize, labelAvailW) : null;

  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${rowBg}" />
      <rect x="7" y="7" width="${iconBoxSize}" height="${iconBoxSize}" rx="8" fill="rgba(15,23,42,0.06)" />
      <text x="${7 + iconBoxSize / 2}" y="${7 + iconBoxSize / 2 + 9}" font-family="'Segoe UI Emoji','Apple Color Emoji',Arial,sans-serif" font-size="${Math.min(26, iconBoxSize - 6)}" text-anchor="middle">${icon}</text>
      <text x="${labelStartX}" y="${subText ? height / 2 - 5 : height / 2 + 10}" font-family="${FONT_TABLE}" font-size="${labelFontSize}" font-weight="700" fill="${LABEL_TEXT_COLOR}" letter-spacing="0.2">${escapeXml(labelText)}</text>
      ${subText ? `<text x="${labelStartX}" y="${height / 2 + 19}" font-family="${FONT_TABLE}" font-size="${subFontSize}" font-weight="700" fill="#475569">${escapeXml(subText)}</text>` : ''}
      <line x1="${dividerX}" y1="8" x2="${dividerX}" y2="${height - 8}" stroke="rgba(15,23,42,0.15)" stroke-width="1.5" />
      <rect x="${dividerX + PILL_GAP}" y="6" width="${rateWidth}" height="${height - 12}" rx="10" fill="${RATE_BG_COLOR}" stroke="${RATE_BORDER_COLOR}" stroke-width="2.5" />
      <text x="${dividerX + PILL_GAP + rateWidth / 2}" y="${height / 2 + 11}" font-family="${FONT_HEADING}" font-size="${valueFontSize}" font-weight="400" fill="${RATE_TEXT_COLOR}" text-anchor="middle">${escapeXml(valueText)}</text>
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="rgba(15,23,42,0.08)" stroke-width="1" />
    </g>
  `;
}

function sectionHeader(x: number, y: number, width: number, height: number, color: string, title: string, icon: string): string {
  const baseSize = width > 400 ? 31 : 24;
  const availW = width - 18 - 16;
  const full = `${icon} ${title}`;
  const size = fitSize(full, FONT_HEADING, 400, baseSize, 18, availW);
  const text = truncateToWidth(full, FONT_HEADING, 400, size, availW);
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="${color}" />
      <rect x="0" y="${height / 2}" width="${width}" height="${height / 2}" fill="${color}" />
      <text x="18" y="${height / 2 + 10}" font-family="${FONT_HEADING}" font-size="${size}" font-weight="400" fill="#ffffff" letter-spacing="0.1">${escapeXml(text)}</text>
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
    if (mh.extraBig?.display) mhItems.push({ label: 'EXTRA BIG (EB)', rate: mh.extraBig.display, icon: '🧅' });
    if (mh.big?.display) mhItems.push({ label: 'BIG QUALITY', rate: mh.big.display, icon: '🧅' });
    if (mh.mukkal?.display) mhItems.push({ label: 'MUKKAL (3/4)', rate: mh.mukkal.display, icon: '🧅' });
    if (mh.medium?.display) mhItems.push({ label: 'MEDIUM (MED)', rate: mh.medium.display, icon: '🧅' });
    if (mh.golta?.display) mhItems.push({ label: 'GOLTA ONION', rate: mh.golta.display, icon: '🧅' });
    if (mh.golty?.display) mhItems.push({ label: 'GOLTY ONION', rate: mh.golty.display, icon: '🧅' });
    if (mh.chopda?.display) mhItems.push({ label: 'CHOPDA', rate: mh.chopda.display, icon: '🧅' });
    if (mh.averageQuality?.display) mhItems.push({ label: 'AVERAGE QUALITY', rate: mh.averageQuality.display, icon: '🧅' });

    const commodities = (report.commodities || []).filter(c => c.name && (c.rate?.display || c.variety));
    const hasMhRates = mhItems.length > 0;
    const hasVJ = !!report.vijayapura?.rate?.display;
    const hasNewOnion = !!(report.newOnions?.rate?.display || report.newOnions?.bagCount || report.newOnions?.lotRate?.display);
    const hasCommodities = commodities.length > 0;

    if (!hasMhRates && !hasVJ && !hasNewOnion && !hasCommodities) {
      mhItems.push({ label: 'REGULAR ONION', rate: '4000-4200', icon: '🧅' });
    }

    const weatherText = report.weather || 'Normal';
    const salesText = report.salesStatus || 'Steady';
    const arrivalsDisplay = report.totalArrivals?.display || '65,000+ bags';
    const trucksDisplay = report.truckCount ? `${report.truckCount} Trucks` : '325+ Trucks';

    const shopNameUpperEarly = settings.shopName.toUpperCase();
    const taglineUpperEarly = (settings.footerTagline || 'Onion Wholesale Merchants').toUpperCase();

    // Measure every string this poster draws before laying anything out, so the
    // synchronous geometry below works from real ink widths instead of guesses.
    // Anything missed here still gets a deliberately wide fallback estimate, so
    // an omission costs a slightly small font, never an overlap.
    await warmTextMetrics([
      ...mhItems.map(i => ({ text: i.label, family: FONT_TABLE, weight: 700 })),
      ...mhItems.map(i => ({ text: i.rate, family: FONT_HEADING, weight: 400 })),
      ...commodities.map(c => ({ text: c.name, family: FONT_TABLE, weight: 700 })),
      ...commodities.map(c => ({ text: [c.variety, c.unit].filter(Boolean).join(' • '), family: FONT_TABLE, weight: 700 })),
      ...commodities.map(c => ({ text: c.rate?.display || 'As Per Quality', family: FONT_HEADING, weight: 400 })),
      ...['RATES', '1-2 LOT', (report.newOnions?.state || 'KARNATAKA').toUpperCase()]
        .map(t => ({ text: t, family: FONT_TABLE, weight: 700 })),
      ...[
        report.vijayapura?.rate?.display || '3000-3700',
        report.newOnions?.bagCount || '—',
        report.newOnions?.rate?.display || '1600-3400',
        report.newOnions?.lotRate?.display || '',
      ].map(t => ({ text: t, family: FONT_HEADING, weight: 400 })),
      ...[
        '🧅 MAHARASHTRA ONIONS', '🌾 VIJAYAPURA ONIONS', '🌱 NEW ONIONS',
        '🥬 VEGETABLE & COMMODITY RATES',
        `APMC ${marketShort}`, 'ONION MARKET REPORT', `Date. ${dateDisplay}`,
        'APMC WISE', 'ARRIVALS', arrivalsDisplay, trucksDisplay,
        `RATES FOR ${rateUnit.replace(/^Per\s*/i, '').toUpperCase()}`,
        `${getWeatherIcon(weatherText)} ${weatherText.toUpperCase()}`,
        shopNameUpperEarly, getInitials(settings.shopName),
      ].map(t => ({ text: t, family: FONT_HEADING, weight: 400 })),
      { text: `SALES ${salesText.toUpperCase()}`, family: FONT_TABLE, weight: 700 },
      ...[
        taglineUpperEarly, 'BEST QUALITY', 'BEST RATES', 'TRUSTED SERVICE',
        `📞 ${settings.phone}`, `💬 ${settings.whatsapp}`, settings.apmcAddress,
        (settings.phoneContactName || '').toUpperCase(),
        (settings.whatsappContactName || '').toUpperCase(),
      ].map(t => ({ text: t, family: FONT_BRAND, weight: 800 })),
    ]);

    // ==================================================================
    // Left column: MAHARASHTRA ONIONS table
    // ==================================================================
    const TABLES_TOP = 370;
    const LEFT_X = 36;
    const LEFT_W = 560;
    const RIGHT_X = LEFT_X + LEFT_W + 20;
    const RIGHT_W = 1044 - RIGHT_X;

    const mhRowHeight = mhItems.length > 7 ? 50 : (mhItems.length > 5 ? 60 : 70);
    const mhHeaderH = 40;
    const mhFooterH = 36;
    const mhInteriorW = LEFT_W - 32;
    const mhTableH = hasMhRates ? mhHeaderH + mhItems.length * (mhRowHeight + 2) + 10 + mhFooterH : 0;

    let mhRowsSvg = '';
    const mhDividerX = tableDividerX(
      mhItems.map(i => ({ label: i.label, value: i.rate })), mhInteriorW, mhRowHeight
    );
    mhItems.forEach((item, i) => {
      const y = mhHeaderH + 8 + i * (mhRowHeight + 2);
      mhRowsSvg += heritageRow(16, y, mhInteriorW, mhRowHeight, item.icon, item.label, null, item.rate, i % 2 === 1, mhDividerX);
    });

    const mhSectionSvg = hasMhRates ? `
      <g id="mh-table" transform="translate(${LEFT_X}, ${TABLES_TOP})">
        <rect x="0" y="0" width="${LEFT_W}" height="${mhTableH}" rx="18" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2" />
        ${sectionHeader(0, 0, LEFT_W, mhHeaderH, theme.mhHeaderColor, 'MAHARASHTRA ONIONS', '🧅')}
        ${mhRowsSvg}
        <rect x="0" y="${mhTableH - mhFooterH}" width="${LEFT_W}" height="${mhFooterH}" rx="12" fill="${theme.footerBarColor}" />
        <rect x="0" y="${mhTableH - mhFooterH}" width="${LEFT_W}" height="${mhFooterH / 2}" fill="${theme.footerBarColor}" />
        <text x="${LEFT_W / 2}" y="${mhTableH - mhFooterH / 2 + 9}" font-family="${FONT_HEADING}" font-size="24" font-weight="400" fill="#ffffff" text-anchor="middle" letter-spacing="0.2">RATES FOR ${escapeXml(rateUnit.replace(/^Per\s*/i, '').toUpperCase())}</text>
      </g>
    ` : '';
    const leftBottomY = TABLES_TOP + (hasMhRates ? mhTableH : 0);

    // ==================================================================
    // Right column: Vijayapura + New Onions + Weather
    // ==================================================================
    let rightCursorY = TABLES_TOP;
    let rightColSvg = '';
    const rightInteriorW = RIGHT_W - 32;

    if (hasVJ) {
      const vjHeaderH = 42;
      const vjRowH = 58;
      const vjH = vjHeaderH + vjRowH + 10;
      const vjRate = report.vijayapura?.rate?.display || '3000-3700';
      const vjDividerX = tableDividerX([{ label: 'RATES', value: vjRate }], rightInteriorW, vjRowH);
      rightColSvg += `
        <g id="vj-card" transform="translate(${RIGHT_X}, ${rightCursorY})">
          <rect x="0" y="0" width="${RIGHT_W}" height="${vjH}" rx="16" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2" />
          ${sectionHeader(0, 0, RIGHT_W, vjHeaderH, theme.vjHeaderColor, 'VIJAYAPURA ONIONS', '🌾')}
          ${heritageRow(16, vjHeaderH + 8, rightInteriorW, vjRowH, '🧅', 'RATES', null, vjRate, false, vjDividerX)}
        </g>
      `;
      rightCursorY += vjH + 8;
    }

    if (hasNewOnion) {
      const noHeaderH = 42;
      const noRows: { label: string; value: string }[] = [];
      if (report.newOnions?.state || report.newOnions?.bagCount) {
        noRows.push({ label: (report.newOnions?.state || 'KARNATAKA').toUpperCase(), value: report.newOnions?.bagCount || '—' });
      }
      noRows.push({ label: 'RATES', value: report.newOnions?.rate?.display || '1600-3400' });
      if (report.newOnions?.lotRate?.display) {
        noRows.push({ label: '1-2 LOT', value: report.newOnions.lotRate.display });
      }
      const noRowH = 52;
      const salesH = 34;
      const salesGap = 10;
      const noH = noHeaderH + noRows.length * (noRowH + 4) + salesGap + salesH;
      const salesLabel = `SALES ${salesText.toUpperCase()}`;
      const salesSize = fitSize(salesLabel, FONT_TABLE, 700, 26, 16, RIGHT_W - 32);

      let noRowsSvg = '';
      const noDividerX = tableDividerX(noRows, rightInteriorW, noRowH);
      noRows.forEach((r, i) => {
        const y = noHeaderH + 8 + i * (noRowH + 4);
        noRowsSvg += heritageRow(16, y, rightInteriorW, noRowH, '🧅', r.label, null, r.value, i % 2 === 1, noDividerX);
      });

      rightColSvg += `
        <g id="no-card" transform="translate(${RIGHT_X}, ${rightCursorY})">
          <rect x="0" y="0" width="${RIGHT_W}" height="${noH}" rx="16" fill="#fffdf6" stroke="${CARD_BORDER}" stroke-width="2" />
          ${sectionHeader(0, 0, RIGHT_W, noHeaderH, theme.newOnionHeaderColor, 'NEW ONIONS', '🌱')}
          ${noRowsSvg}
          <text x="16" y="${noH - 11}" font-family="${FONT_TABLE}" font-size="${salesSize}" font-weight="700" fill="${RATE_TEXT_COLOR}" letter-spacing="0.2">${escapeXml(salesLabel)}</text>
        </g>
      `;
      rightCursorY += noH + 8;
    }

    // Weather bar
    const weatherH = 58;
    rightColSvg += `
      <g id="weather-bar" transform="translate(${RIGHT_X}, ${rightCursorY})">
        <rect x="0" y="0" width="${RIGHT_W}" height="${weatherH}" rx="14" fill="${theme.weatherBarColor}" />
        <text x="${RIGHT_W / 2}" y="${weatherH / 2 + 10}" font-family="${FONT_HEADING}" font-size="28" font-weight="400" fill="#ffffff" text-anchor="middle" letter-spacing="0.1">${getWeatherIcon(weatherText)} ${escapeXml(weatherText.toUpperCase())}</text>
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
      const vegHeaderH = 44;
      const vegRowH = commodities.length > 6 ? 50 : 60;
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
          ${sectionHeader(0, 0, 1008, vegHeaderH, theme.vegHeaderColor, 'VEGETABLE & COMMODITY RATES', '🥬')}
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
    const topBlockBottom = 178;
    const hasPhoneContact = !!(settings.phoneContactName && settings.phoneContactName.trim());
    const hasWhatsappContact = !!(settings.whatsappContactName && settings.whatsappContactName.trim());
    const namesRowH = (hasPhoneContact || hasWhatsappContact) ? 34 : 0;
    const namesGap = namesRowH > 0 ? 8 : 0;
    const namesBlockH = namesRowH + namesGap;
    const bottomBlockH = namesBlockH + 90 + 14 + 84;
    const bottomPad = 14;
    const minFooterH = topBlockBottom + bottomBlockH + bottomPad + 10;

    let footerY = Math.max(afterVegY + 10, Math.round(CANVAS_H * 0.55));
    const maxFooterY = CANVAS_H - 24 - minFooterH;
    if (footerY > maxFooterY) footerY = maxFooterY;
    // Never let the overflow cap above push the footer card up into the table
    // content that ends at afterVegY — overlap is worse than a snug footer.
    footerY = Math.max(footerY, afterVegY + 10);
    const footerH = CANVAS_H - footerY - 24;

    const initials = getInitials(settings.shopName);
    const shopNameUpper = settings.shopName.toUpperCase();
    // Banner is 764 wide starting at x=204; keep 24px of plaque either side.
    const shopHeaderFontSize = fitSize(shopNameUpper, FONT_HEADING, 400, 46, 22, 716);

    const taglineUpper = (settings.footerTagline || 'Onion Wholesale Merchants').toUpperCase();
    const taglineFontSize = fitSize(taglineUpper, FONT_BRAND, 800, 20, 12, 730);

    // Anchor the name tags + contact bar + address to the bottom of the card, so
    // short reports (tall leftover card space) don't leave a dead gap below the
    // address bar. footerH is guaranteed >= minFooterH above, so this never
    // overflows the card.
    const contactY = Math.max(topBlockBottom + 20 + namesBlockH, footerH - bottomBlockH - bottomPad);
    const namesY = contactY - namesBlockH;
    const addressY = contactY + 104;
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
    const titleFontSize = fitSize(titleFull, FONT_HEADING, 400, 64, 34, TITLE_MAX_W);
    const titleText = truncateToWidth(titleFull, FONT_HEADING, 400, titleFontSize, TITLE_MAX_W);
    const subtitleFontSize = fitSize('ONION MARKET REPORT', FONT_HEADING, 400, 40, 24, TITLE_MAX_W);

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
        <!-- Onion cluster decorations (emoji fallback; skipped when onion.png photo is composited) -->
        ${hasOnionPhoto ? '' : `
        <g transform="translate(64, 58)">
          <text x="-16" y="8" font-family="'Segoe UI Emoji','Apple Color Emoji',Arial,sans-serif" font-size="68" text-anchor="middle" transform="rotate(-12)">🧅</text>
          <text x="34" y="28" font-family="'Segoe UI Emoji','Apple Color Emoji',Arial,sans-serif" font-size="46" text-anchor="middle" transform="rotate(10)">🧅</text>
        </g>
        <g transform="translate(1016, 58)">
          <text x="16" y="8" font-family="'Segoe UI Emoji','Apple Color Emoji',Arial,sans-serif" font-size="68" text-anchor="middle" transform="rotate(12)">🧅</text>
          <text x="-34" y="28" font-family="'Segoe UI Emoji','Apple Color Emoji',Arial,sans-serif" font-size="46" text-anchor="middle" transform="rotate(-10)">🧅</text>
        </g>
        `}

        <text x="540" y="62" font-family="${FONT_HEADING}" font-size="${titleFontSize}" font-weight="400" fill="${theme.titleColor}" text-anchor="middle" letter-spacing="0.3" stroke="#ffffff" stroke-width="2.5" paint-order="stroke">${escapeXml(titleText)}</text>
        <text x="540" y="104" font-family="${FONT_HEADING}" font-size="${subtitleFontSize}" font-weight="400" fill="${theme.subtitleColor}" text-anchor="middle" letter-spacing="0.3">ONION MARKET REPORT</text>
      </g>

      <!-- ============================ -->
      <!-- 2. DATE BADGE                 -->
      <!-- ============================ -->
      <g id="date-badge" transform="translate(36, 172)" filter="url(#softShadow)">
        <rect x="0" y="0" width="1008" height="64" rx="16" fill="${theme.dateBadgeColor}" />
        <rect x="200" y="6" width="608" height="52" rx="14" fill="${RATE_BG_COLOR}" stroke="${RATE_BORDER_COLOR}" stroke-width="2.5" />
        <text x="228" y="43" font-family="'Segoe UI Emoji','Apple Color Emoji',Arial,sans-serif" font-size="30">📅</text>
        <text x="274" y="43" font-family="${FONT_HEADING}" font-size="32" font-weight="400" fill="${RATE_TEXT_COLOR}" letter-spacing="0.2">Date. ${escapeXml(dateDisplay)}</text>
      </g>

      <!-- ============================ -->
      <!-- 3. ARRIVALS BAR                -->
      <!-- ============================ -->
      <g id="arrivals-bar" transform="translate(36, 248)" filter="url(#softShadow)">
        <rect x="0" y="0" width="1008" height="112" rx="16" fill="${theme.arrivalsBarColor}" />
        <text x="24" y="42" font-family="${FONT_HEADING}" font-size="27" font-weight="400" fill="#ffffff" letter-spacing="0.1">APMC WISE</text>
        <text x="24" y="76" font-family="${FONT_HEADING}" font-size="27" font-weight="400" fill="#ffffff" letter-spacing="0.1">ARRIVALS</text>
        <line x1="298" y1="14" x2="298" y2="98" stroke="rgba(255,255,255,0.35)" stroke-width="2" />
        <text x="326" y="48" font-family="${FONT_HEADING}" font-size="40" font-weight="400" fill="#fde047">${escapeXml(arrivalsDisplay)}</text>
        <text x="326" y="92" font-family="${FONT_HEADING}" font-size="36" font-weight="400" fill="#fde047">${escapeXml(trucksDisplay)}</text>
        ${hasTruckPhoto ? '' : `<text x="955" y="66" font-family="'Segoe UI Emoji','Apple Color Emoji',Arial,sans-serif" font-size="58" text-anchor="middle">🚛</text>`}
      </g>

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
        <circle cx="100" cy="72" r="54" fill="#fffdf6" stroke="${theme.shopNameColor}" stroke-width="4" />
        ${hasLogoPhoto ? '' : `
        <text x="100" y="85" font-family="${FONT_HEADING}" font-size="36" font-weight="400" fill="${theme.shopNameColor}" text-anchor="middle">${escapeXml(initials)}</text>
        `}

        <!-- Shop name banner (colored plaque, not plain text-on-white, so it reads as the poster's focal point) -->
        <rect x="204" y="12" width="764" height="58" rx="16" fill="url(#shopBannerGrad)" />
        <text x="586" y="53" font-family="${FONT_HEADING}" font-size="${shopHeaderFontSize}" font-weight="400" fill="#fde047" text-anchor="middle" letter-spacing="0.2" stroke="#00000055" stroke-width="0.5">${escapeXml(shopNameUpper)}</text>
        <rect x="190" y="78" width="778" height="38" rx="19" fill="${theme.pillA}" />
        <text x="579" y="103" font-family="${FONT_BRAND}" font-size="${taglineFontSize}" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.2">${escapeXml(taglineUpper)}</text>

        <!-- Feature pills -->
        <g transform="translate(76, 128)">
          <rect x="0" y="0" width="270" height="44" rx="22" fill="${theme.pillA}" />
          <text x="135" y="28" font-family="${FONT_BRAND}" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.2">BEST QUALITY</text>
          <rect x="292" y="0" width="270" height="44" rx="22" fill="${theme.pillB}" />
          <text x="427" y="28" font-family="${FONT_BRAND}" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.2">BEST RATES</text>
          <rect x="584" y="0" width="270" height="44" rx="22" fill="${theme.pillA}" />
          <text x="719" y="28" font-family="${FONT_BRAND}" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.2">TRUSTED SERVICE</text>
        </g>

        <!-- Contact-person name tags (above the matching number below) -->
        ${namesRowSvg}

        <!-- Contact bar -->
        <g transform="translate(24, ${contactY})">
          <rect x="0" y="0" width="960" height="90" rx="45" fill="url(#contactGrad)" />
          <line x1="480" y1="12" x2="480" y2="78" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
          <text x="240" y="56" font-family="${FONT_BRAND}" font-size="${fitSize('📞 ' + settings.phone, FONT_BRAND, 800, 32, 18, 420)}" font-weight="800" fill="#ffffff" text-anchor="middle">📞 ${escapeXml(settings.phone)}</text>
          <text x="720" y="56" font-family="${FONT_BRAND}" font-size="${fitSize('💬 ' + settings.whatsapp, FONT_BRAND, 800, 32, 18, 420)}" font-weight="800" fill="#ffffff" text-anchor="middle">💬 ${escapeXml(settings.whatsapp)}</text>
        </g>

        <!-- Address -->
        <g transform="translate(24, ${addressY})">
          <rect x="0" y="0" width="960" height="84" rx="16" fill="${theme.addressBg}" stroke="${theme.addressBorder}" stroke-width="2" />
          <text x="480" y="34" font-family="'Segoe UI Emoji','Apple Color Emoji',Arial,sans-serif" font-size="21" text-anchor="middle">📍</text>
          <text x="480" y="63" font-family="${FONT_BRAND}" font-size="${fitSize(settings.apmcAddress, FONT_BRAND, 800, 22, 12, 900)}" font-weight="800" fill="${theme.addressText}" text-anchor="middle">${escapeXml(settings.apmcAddress)}</text>
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

    if (hasTruckPhoto) {
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
      const LOGO_SIZE = 96;
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
      const LOGO_CX = 36 + 100;
      const LOGO_CY = footerY + 72;
      compositeOps.push({ input: circularLogo, left: Math.round(LOGO_CX - LOGO_SIZE / 2), top: Math.round(LOGO_CY - LOGO_SIZE / 2) });
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
