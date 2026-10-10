// Must precede the sharp import - see fontconfig.ts.
import './fontconfig';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { MarketReportNormalized, ShopSettings, PosterSize } from '../../../../shared/types';
import { ASSETS_DIR as SERVER_ASSETS_DIR, PUBLIC_DIR as SERVER_PUBLIC_DIR } from '../../paths';
import { warmTextMetrics, widthOf, fitSize, truncateToWidth } from './textMetrics';
import { renderIcon } from './icons';

/**
 * Large-print poster: a second layout built for readers who need the rates
 * very big. Same data as the classic poster, laid out as a traditional mandi
 * board - cream paper, thick framed border, ribbon headings, dotted leaders
 * from each grade to a gold rate plaque - in three shapes for WhatsApp.
 *
 * Every row height is derived from how many rows the report has, so the type
 * is as large as the canvas allows; nothing is dropped and nothing scrolls.
 */

const POSTERS_DIR = path.join(SERVER_PUBLIC_DIR, 'posters');
if (!fs.existsSync(POSTERS_DIR)) fs.mkdirSync(POSTERS_DIR, { recursive: true });

const PHOTOS = path.join(SERVER_ASSETS_DIR, 'photos');
const LOGO_PHOTO = path.join(PHOTOS, 'logo.png');
const ONION_PHOTO = [
  path.join(PHOTOS, 'commodities', 'onion.png'),
  path.join(PHOTOS, 'onion.png'),
].find(p => fs.existsSync(p));

const FONT = "'Montserrat', 'Arial Black', Impact, sans-serif";
const WEIGHT = 800;

const C = {
  paperA: '#fff6dc',
  paperB: '#f6e3b0',
  maroon: '#7f1d1d',
  maroonDark: '#450a0a',
  red: '#b91c1c',
  gold: '#d99a06',
  goldLight: '#fde047',
  goldDeep: '#a16207',
  green: '#14532d',
  navy: '#1e3a8a',
  ink: '#1e3a8a',
  bandA: '#fffdf4',
  bandB: '#f5e6b8',
};
const SECTION_COLORS = [C.maroon, C.green, C.navy, '#581c87'];

interface Geo {
  W: number;
  H: number;
  cols: number;
  headerH: number;
  stripH: number;
  footerH: number;
  rowCap: number;
  header: 'tall' | 'flat' | 'wide';
  footer: 'stacked' | 'compact' | 'wide';
}

function geometry(size: PosterSize, totalRows: number): Geo {
  if (size === '1:1') {
    return { W: 1080, H: 1080, cols: 2, headerH: 150, stripH: 52, footerH: 206, rowCap: 100, header: 'flat', footer: 'compact' };
  }
  if (size === '16:9') {
    return { W: 1920, H: 1080, cols: totalRows >= 15 ? 3 : 2, headerH: 150, stripH: 60, footerH: 216, rowCap: 120, header: 'wide', footer: 'wide' };
  }
  return { W: 1080, H: 1920, cols: 1, headerH: 246, stripH: 70, footerH: 296, rowCap: 124, header: 'tall', footer: 'stacked' };
}

interface Row { label: string; value: string }
interface Sec { title: string; rows: Row[] }

/** Same data the classic poster draws, flattened to titled lists of label/value. */
function buildSections(report: MarketReportNormalized): Sec[] {
  const parsed = (report.sections || []).filter(s => s.title && (s.rows || []).length > 0);
  if (parsed.length > 0) {
    return parsed
      .map(s => {
        const rows: Row[] = [];
        if (s.count) rows.push({ label: 'ARRIVALS', value: s.count });
        s.rows.forEach(r => {
          if (r.rate?.display) rows.push({ label: r.label.toUpperCase(), value: r.rate.display });
        });
        return { title: s.title.toUpperCase(), rows };
      })
      .filter(s => s.rows.length > 0);
  }

  const out: Sec[] = [];
  const mh = report.maharashtra;
  const mhRows: Row[] = [];
  const add = (label: string, r: { display?: string } | null | undefined) => {
    if (r?.display) mhRows.push({ label, value: r.display });
  };
  if (mh) {
    add('EXTRA BIG', mh.extraBig); add('BIG', mh.big); add('MUKKAL', mh.mukkal); add('MEDIUM', mh.medium);
    add('GOLTA', mh.golta); add('GOLTY', mh.golty); add('CHOPDA', mh.chopda); add('AVERAGE QUALITY', mh.averageQuality);
  }
  if (mhRows.length) out.push({ title: 'MAHARASHTRA ONIONS', rows: mhRows });

  if (report.vijayapura?.rate?.display) {
    out.push({ title: 'VIJAYAPURA ONIONS', rows: [{ label: 'RATES', value: report.vijayapura.rate.display }] });
  }

  const no = report.newOnions;
  const noRows: Row[] = [];
  if (no?.bagCount) noRows.push({ label: 'ARRIVALS', value: no.bagCount });
  (no?.grades || []).forEach(g => { if (g.label && g.rate?.display) noRows.push({ label: g.label.toUpperCase(), value: g.rate.display }); });
  if (no?.rate?.display) noRows.push({ label: 'RATES', value: no.rate.display });
  if (no?.lotRate?.display) noRows.push({ label: '1-2 LOT', value: no.lotRate.display });
  if (noRows.length) out.push({ title: (no?.state || 'NEW ONIONS').toUpperCase(), rows: noRows });

  const veg = (report.commodities || []).filter(c => c.name && c.rate?.display);
  if (veg.length) out.push({ title: 'VEGETABLE & COMMODITY RATES', rows: veg.map(c => ({ label: c.name.toUpperCase(), value: c.rate!.display })) });

  return out;
}

const esc = (s: string | null | undefined) =>
  !s ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Bold text: the display face has one weight, so stroke it in its own colour. */
function txt(
  x: number, y: number, s: string, size: number, fill: string,
  opts: { anchor?: 'start' | 'middle' | 'end'; stroke?: number; strokeColor?: string; spacing?: number } = {}
): string {
  const sw = opts.stroke ?? Math.max(0.8, size * 0.018);
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${WEIGHT}" fill="${fill}" text-anchor="${opts.anchor || 'start'}" stroke="${opts.strokeColor || fill}" stroke-width="${sw}" paint-order="stroke" stroke-linejoin="round" letter-spacing="${opts.spacing ?? 0.2}">${esc(s)}</text>`;
}

/** Ribbon with notched ends - the heading shape on a traditional price board. */
function ribbon(x: number, y: number, w: number, h: number, fill: string): string {
  const n = Math.min(18, h * 0.3);
  const pts = `${x},${y} ${x + w},${y} ${x + w - n},${y + h / 2} ${x + w},${y + h} ${x},${y + h} ${x + n},${y + h / 2}`;
  return `<polygon points="${pts}" fill="${fill}" stroke="${C.gold}" stroke-width="3" stroke-linejoin="round" />`;
}

type Item = { kind: 'head'; title: string; color: string } | { kind: 'row'; row: Row; idx: number; w: number };

export class LargePosterGenerator {
  static async generate(
    report: MarketReportNormalized,
    settings: ShopSettings,
    size: PosterSize
  ): Promise<{ fileName: string; absolutePath: string; urlPath: string }> {
    let sections = buildSections(report);
    if (sections.length === 0) sections = [{ title: 'ONION RATES', rows: [{ label: 'REGULAR ONION', value: '—' }] }];
    const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
    const g = geometry(size, totalRows);
    const { W, H } = g;

    // ---- header / strip / footer text ----
    const dateDisplay = report.reportDateDisplay || report.reportDate || '';
    const market = (report.market || 'BENGALURU').replace(/^APMC\s*/i, '').trim().toUpperCase() || 'BENGALURU';
    const title = `APMC ${market}`;
    const arrivals = report.totalArrivals?.display?.trim() || '';
    const truckBare = report.truckCount?.replace(/\s*(?:trucks?|lorr(?:y|ies))\s*$/i, '').trim();
    const trucks = truckBare ? `${truckBare} Trucks` : '';
    const arrivalsLine = [arrivals, trucks].filter(Boolean).join('  •  ');
    const salesText = (report.salesStatus || '').replace(/^\s*sales\s+/i, '').trim();
    const chips: { text: string; color: string }[] = [];
    if (salesText) chips.push({ text: `SALES ${salesText.toUpperCase()}`, color: C.red });
    if (report.weather) chips.push({ text: report.weather.toUpperCase(), color: C.navy });
    chips.push({ text: `RATES FOR ${(report.rateUnit || 'Per 100 kg').replace(/^Per\s*/i, '').toUpperCase()}`, color: C.green });

    const shopName = settings.shopName.toUpperCase();
    const tagline = (settings.footerTagline || '').toUpperCase();
    const initials = (() => {
      const w = settings.shopName.split(/\s+/).filter(x => /[A-Za-z]/.test(x));
      return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : (w[0] || 'AP').slice(0, 2).toUpperCase();
    })();

    await warmTextMetrics([
      ...sections.flatMap(s => [
        { text: s.title, family: FONT, weight: WEIGHT },
        ...s.rows.flatMap(r => [{ text: r.label, family: FONT, weight: WEIGHT }, { text: r.value, family: FONT, weight: WEIGHT }]),
      ]),
      ...[title, 'ONION MARKET REPORT', dateDisplay, `DATE ${dateDisplay}`, arrivalsLine, shopName, tagline, initials,
        settings.phone, settings.whatsapp, settings.apmcAddress, ...chips.map(c => c.text)]
        .map(t => ({ text: t, family: FONT, weight: WEIGHT })),
    ]);

    // ---- frame ----
    const FR = 30; // outer border inset
    const innerX = FR + 22;
    const innerW = W - innerX * 2;
    let y = FR + 20;

    const parts: string[] = [];
    const composites: sharp.OverlayOptions[] = [];

    // ---- header ----
    const headerTop = y;
    const plaque = (x: number, py: number, w: number, h: number, fill: string, lines: { t: string; s: number; c: string; dy: number }[]) => {
      parts.push(`<rect x="${x}" y="${py}" width="${w}" height="${h}" rx="${h / 2.6}" fill="${fill}" stroke="${C.gold}" stroke-width="3.5" />`);
      lines.forEach(l => parts.push(txt(x + w / 2, py + l.dy, l.t, l.s, l.c, { anchor: 'middle' })));
    };

    const onionH = g.header === 'tall' ? 118 : g.header === 'flat' ? 92 : 120;
    let onionW = 0;
    if (ONION_PHOTO) {
      const meta = await sharp(ONION_PHOTO).metadata();
      onionW = Math.round(onionH * ((meta.width || 1536) / (meta.height || 1024)));
      const left = await sharp(ONION_PHOTO).resize(onionW, onionH, { fit: 'contain' }).toBuffer();
      composites.push({ input: left, left: FR + 6, top: headerTop - 6 });
      if (g.header !== 'wide') {
        const right = await sharp(ONION_PHOTO).flop().resize(onionW, onionH, { fit: 'contain' }).toBuffer();
        composites.push({ input: right, left: W - FR - 6 - onionW, top: headerTop - 6 });
      }
    }

    const dateText = dateDisplay ? `DATE  ${dateDisplay}` : '';
    if (g.header === 'tall' || g.header === 'flat') {
      const tall = g.header === 'tall';
      const titleAvail = W - 2 * (FR + onionW + 24);
      const tSize = fitSize(title, FONT, WEIGHT, tall ? 82 : 60, 30, titleAvail);
      const subSize = fitSize('ONION MARKET REPORT', FONT, WEIGHT, tall ? 44 : 32, 18, titleAvail);
      const tY = headerTop + (tall ? 74 : 46);
      parts.push(txt(W / 2, tY, title, tSize, C.red, { anchor: 'middle', stroke: tSize * 0.05, strokeColor: '#ffffff' }));
      parts.push(txt(W / 2, tY + (tall ? 50 : 32), 'ONION MARKET REPORT', subSize, C.green, { anchor: 'middle' }));
      const rowY = headerTop + (tall ? 136 : 84);
      const rowH = tall ? 88 : 60;
      const dW = Math.round(innerW * (arrivalsLine ? 0.42 : 1));
      const dSize = fitSize(dateText, FONT, WEIGHT, tall ? 46 : 36, 16, dW - 40);
      if (dateText) plaque(innerX, rowY, dW, rowH, C.navy, [{ t: dateText, s: dSize, c: '#ffffff', dy: rowH / 2 + dSize * 0.36 }]);
      if (arrivalsLine) {
        const aX = innerX + dW + 14;
        const aW = innerW - dW - 14;
        const aSize = fitSize(arrivalsLine, FONT, WEIGHT, tall ? 46 : 36, 16, aW - 40);
        plaque(aX, rowY, aW, rowH, C.green, [{ t: arrivalsLine, s: aSize, c: C.goldLight, dy: rowH / 2 + aSize * 0.36 }]);
      }
    } else {
      const titleX = innerX + onionW + 22;
      const rightW = Math.round(W * 0.5);
      const titleAvail = W - FR - 22 - rightW - titleX - 20;
      const tSize = fitSize(title, FONT, WEIGHT, 76, 34, titleAvail);
      const subSize = fitSize('ONION MARKET REPORT', FONT, WEIGHT, 38, 20, titleAvail);
      parts.push(txt(titleX, headerTop + 70, title, tSize, C.red, { stroke: tSize * 0.05, strokeColor: '#ffffff' }));
      parts.push(txt(titleX, headerTop + 70 + 48, 'ONION MARKET REPORT', subSize, C.green));
      const rx = W - innerX - rightW;
      const ph = 104;
      const py = headerTop + 12;
      const dW = Math.round(rightW * (arrivalsLine ? 0.4 : 1));
      const dSize = fitSize(dateText, FONT, WEIGHT, 44, 16, dW - 40);
      if (dateText) plaque(rx, py, dW, ph, C.navy, [{ t: dateText, s: dSize, c: '#ffffff', dy: ph / 2 + dSize * 0.36 }]);
      if (arrivalsLine) {
        const aX = rx + dW + 14;
        const aW = rightW - dW - 14;
        const aSize = fitSize(arrivalsLine, FONT, WEIGHT, 44, 16, aW - 40);
        plaque(aX, py, aW, ph, C.green, [{ t: arrivalsLine, s: aSize, c: C.goldLight, dy: ph / 2 + aSize * 0.36 }]);
      }
    }
    y = headerTop + g.headerH;

    // ---- footer geometry first, so the body knows how much room it has ----
    const footerTop = H - FR - 20 - g.footerH;
    const stripTop = footerTop - 12 - g.stripH;
    const bodyTop = y + 8;
    const bodyBottom = stripTop - 10;
    const bodyH = bodyBottom - bodyTop;

    // ---- split into columns ----
    // Sections are cut into contiguous runs of rows, one run per column. A cut
    // inside a section repeats its heading in the next column. The partition
    // that makes the tallest column shortest wins, so row height - and with it
    // the type - is as large as the canvas allows.
    const HEAD_UNITS = 0.82;
    const GAP_UNITS = 0.16;
    const HEAD_COST = HEAD_UNITS + GAP_UNITS * 2;
    // A long sentence label gets a taller row (up to three lines) so it can stay big
    // instead of shrinking to fit one row's height.
    const rowWeight = (label: string) => (label.split(/\s+/).length >= 3 && label.length >= 22 ? 1.8 : 1);
    const flat = sections.flatMap((s, si) => s.rows.map(row => ({ si, row, w: rowWeight(row.label) })));
    const segUnits = (a: number, b: number) => {
      let u = 0;
      let last = -1;
      for (let k = a; k < b; k++) { u += flat[k].w; if (flat[k].si !== last) { u += HEAD_COST; last = flat[k].si; } }
      return u;
    };
    // A column holding a single row of a longer section reads as an orphan.
    const segPenalty = (a: number, b: number) => {
      const si0 = flat[a].si, si1 = flat[b - 1].si;
      let pen = 0;
      if (si0 === si1 && b - a === 1 && sections[si0].rows.length > 1) pen += 1.5;
      return pen;
    };
    const plan = (nCols: number): { cuts: number[]; worst: number } => {
      const n = flat.length;
      let best = { cuts: [] as number[], worst: Infinity, score: Infinity };
      const consider = (cuts: number[]) => {
        const edges = [0, ...cuts, n];
        let worst = 0, pen = 0, splits = 0;
        for (let i = 0; i < edges.length - 1; i++) {
          if (edges[i + 1] <= edges[i]) return;
          worst = Math.max(worst, segUnits(edges[i], edges[i + 1]));
          pen += segPenalty(edges[i], edges[i + 1]);
        }
        cuts.forEach(c => { if (flat[c - 1].si === flat[c].si) splits++; });
        const score = worst + pen + splits * 0.02;
        if (score < best.score) best = { cuts, worst, score };
      };
      if (nCols === 1) consider([]);
      else if (nCols === 2) for (let i = 1; i < n; i++) consider([i]);
      else for (let i = 1; i < n; i++) for (let j = i + 1; j < n; j++) consider([i, j]);
      return { cuts: best.cuts, worst: best.worst };
    };
    let nCols = g.cols;
    let chosen = plan(nCols);
    if (size === '16:9' && flat.length >= 2) {
      // Fewer, wider columns unless a third one makes the rows clearly taller.
      const two = plan(2);
      const three = flat.length >= 3 ? plan(3) : two;
      const h2 = Math.min(g.rowCap, bodyH / two.worst);
      const h3 = Math.min(g.rowCap, bodyH / three.worst);
      if (h3 > h2 * 1.15) { nCols = 3; chosen = three; } else { nCols = 2; chosen = two; }
    } else if (flat.length < nCols) {
      nCols = Math.max(1, flat.length);
      chosen = plan(nCols);
    }
    const cols: Item[][] = Array.from({ length: nCols }, () => []);
    {
      const edges = [0, ...chosen.cuts, flat.length];
      for (let c = 0; c < nCols; c++) {
        let last = -1;
        let ri = 0;
        for (let k = edges[c]; k < edges[c + 1]; k++) {
          if (flat[k].si !== last) {
            last = flat[k].si;
            ri = 0;
            cols[c].push({ kind: 'head', title: sections[last].title, color: SECTION_COLORS[last % SECTION_COLORS.length] });
          }
          cols[c].push({ kind: 'row', row: flat[k].row, idx: ri++, w: flat[k].w });
        }
      }
    }
    const units = (items: Item[]) => items.reduce((u, it) => u + (it.kind === 'head' ? HEAD_COST : it.w), 0);

    const colGap = 26;
    const colW = Math.floor((innerW - colGap * (nCols - 1)) / nCols);
    const maxUnits = Math.max(...cols.map(units));
    const rowH = Math.min(g.rowCap, Math.floor(bodyH / Math.max(maxUnits, 1)));
    const headH = Math.round(rowH * HEAD_UNITS);
    const gapH = Math.round(rowH * GAP_UNITS);
    const usedH = Math.max(...cols.map(c => c.reduce((h, it) => h + (it.kind === 'head' ? headH + gapH * 2 : Math.round(rowH * it.w)), 0)));
    const startY = bodyTop + Math.max(0, Math.floor((bodyH - usedH) / 2));

    cols.forEach((items, c) => {
      if (items.length === 0) return;
      const cx = innerX + c * (colW + colGap);
      const rows = items.filter((i): i is Extract<Item, { kind: 'row' }> => i.kind === 'row');

      // One rate-plaque width and size per column keeps the figures in a straight line.
      const padX = Math.round(rowH * 0.22);
      const maxPill = Math.round(colW * 0.52);
      let vSize = Math.min(Math.round(rowH * 0.84), 110);
      rows.forEach(r => { vSize = Math.min(vSize, fitSize(r.row.value, FONT, WEIGHT, vSize, 20, maxPill - padX * 2 - 14)); });
      const pillW = Math.min(maxPill, Math.max(...rows.map(r => widthOf(r.row.value, FONT, WEIGHT, vSize))) + padX * 2);
      const labelAvail = colW - padX * 2 - pillW - 26;
      const labelBase = Math.min(Math.round(rowH * 0.78), 100);

      let cy = startY;
      items.forEach(it => {
        if (it.kind === 'head') {
          if (cy > startY) cy += gapH;
          const hs = fitSize(it.title, FONT, WEIGHT, Math.round(headH * 0.68), 18, colW - 70);
          parts.push(ribbon(cx, cy, colW, headH, it.color));
          parts.push(txt(cx + colW / 2, cy + headH / 2 + hs * 0.36, truncateToWidth(it.title, FONT, WEIGHT, hs, colW - 60), hs, '#ffffff', { anchor: 'middle', spacing: 0.6 }));
          cy += headH + gapH;
          return;
        }
        const { row, idx } = it;
        const rowHi = Math.round(rowH * it.w);
        parts.push(`<rect x="${cx}" y="${cy}" width="${colW}" height="${rowHi}" rx="${Math.round(rowH * 0.16)}" fill="${idx % 2 ? C.bandB : C.bandA}" stroke="rgba(127,29,29,0.22)" stroke-width="1.5" />`);

        // Rate plaque.
        const px = cx + colW - padX / 2 - pillW;
        const ph = rowH - 12;
        const pyTop = cy + (rowHi - ph) / 2;
        parts.push(`<rect x="${px}" y="${pyTop}" width="${pillW}" height="${ph}" rx="${Math.round(ph * 0.3)}" fill="url(#gold)" stroke="${C.goldDeep}" stroke-width="3" />`);
        parts.push(txt(px + pillW / 2, cy + rowHi / 2 + vSize * 0.36, row.value, vSize, C.maroon, { anchor: 'middle', stroke: vSize * 0.03 }));

        // Label: one line, or the balanced 2-3 line split that lets the type be largest.
        const lx = cx + padX;
        const words = row.label.split(/\s+/).filter(Boolean);
        const lineSize = (lines: string[]) =>
          Math.min(
            labelBase,
            lines.length === 1 ? labelBase : Math.floor((rowHi - 8) / (lines.length === 2 ? 1.9 : 2.94)),
            ...lines.map(l => fitSize(l, FONT, WEIGHT, labelBase, 1, labelAvail))
          );
        let best = { lines: [row.label], size: lineSize([row.label]) };
        for (let k = 1; k < words.length; k++) {
          const two = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
          const sz2 = lineSize(two);
          if (sz2 > best.size) best = { lines: two, size: sz2 };
          if (it.w > 1) {
            for (let m = k + 1; m < words.length; m++) {
              const three = [words.slice(0, k).join(' '), words.slice(k, m).join(' '), words.slice(m).join(' ')];
              const sz3 = lineSize(three);
              if (sz3 > best.size) best = { lines: three, size: sz3 };
            }
          }
        }
        if (best.lines.length === 1) {
          const oneLine = best.size;
          parts.push(txt(lx, cy + rowHi / 2 + oneLine * 0.36, row.label, oneLine, C.ink));
          // Dotted leader from the label to the plaque.
          const lw = widthOf(row.label, FONT, WEIGHT, oneLine);
          const x1 = lx + lw + 12;
          const x2 = px - 12;
          if (x2 - x1 > 24) parts.push(`<line x1="${x1}" y1="${cy + rowHi / 2 + oneLine * 0.3}" x2="${x2}" y2="${cy + rowHi / 2 + oneLine * 0.3}" stroke="${C.goldDeep}" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round" />`);
        } else {
          const n = best.lines.length;
          const lead = best.size * 1.04;
          const block = best.size * 0.8 + lead * (n - 1);
          const top = cy + (rowHi - block) / 2;
          best.lines.forEach((l, li) => parts.push(txt(lx, top + best.size * 0.8 + li * lead, l, best.size, C.ink)));
        }
        cy += rowHi;
      });
    });

    // ---- strip ----
    {
      const n = chips.length;
      const gap = 14;
      const cw = Math.floor((innerW - gap * (n - 1)) / n);
      chips.forEach((chip, i) => {
        const x = innerX + i * (cw + gap);
        const s = fitSize(chip.text, FONT, WEIGHT, Math.round(g.stripH * 0.6), 14, cw - 44);
        parts.push(`<rect x="${x}" y="${stripTop}" width="${cw}" height="${g.stripH}" rx="${g.stripH / 2.6}" fill="${chip.color}" stroke="${C.gold}" stroke-width="3" />`);
        parts.push(txt(x + cw / 2, stripTop + g.stripH / 2 + s * 0.36, chip.text, s, '#ffffff', { anchor: 'middle' }));
      });
    }

    // ---- shop plaque ----
    parts.push(`<rect x="${innerX}" y="${footerTop}" width="${innerW}" height="${g.footerH}" rx="22" fill="url(#maroonGrad)" stroke="${C.gold}" stroke-width="4" />`);
    parts.push(`<rect x="${innerX + 8}" y="${footerTop + 8}" width="${innerW - 16}" height="${g.footerH - 16}" rx="16" fill="none" stroke="${C.gold}" stroke-width="1.5" opacity="0.7" />`);

    const pill = (x: number, py: number, w: number, h: number, icon: string, label: string, fill: string) => {
      const s = fitSize(label, FONT, WEIGHT, Math.round(h * 0.6), 14, w - h - 20);
      const iw = widthOf(label, FONT, WEIGHT, s);
      const totalW = iw + h * 0.62 + 12;
      const sx = x + (w - totalW) / 2;
      parts.push(`<rect x="${x}" y="${py}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${C.goldLight}" stroke-width="3" />`);
      parts.push(renderIcon(icon, sx, py + h * 0.19, h * 0.62, '#ffffff'));
      parts.push(txt(sx + h * 0.62 + 12, py + h / 2 + s * 0.36, label, s, '#ffffff'));
    };
    const addressPill = (x: number, py: number, w: number, h: number) => {
      const s = fitSize(settings.apmcAddress, FONT, WEIGHT, Math.round(h * 0.56), 11, w - h - 24);
      const iw = widthOf(settings.apmcAddress, FONT, WEIGHT, s);
      const sx = x + (w - (iw + h * 0.6 + 8)) / 2;
      parts.push(`<rect x="${x}" y="${py}" width="${w}" height="${h}" rx="${h / 2.4}" fill="#fff3cd" stroke="${C.goldDeep}" stroke-width="2.5" />`);
      parts.push(renderIcon('pin', sx, py + h * 0.2, h * 0.6));
      parts.push(txt(sx + h * 0.6 + 8, py + h / 2 + s * 0.36, settings.apmcAddress, s, C.maroon));
    };
    // The shop's own logo, fitted whole (never cropped) into a box whose size the
    // layout chooses; the initials disc is only the fallback when no logo file exists.
    const hasLogo = fs.existsSync(LOGO_PHOTO);
    const logo = (cx: number, cy: number, r: number) => {
      if (hasLogo) {
        logoJobs.push({ cx, cy, box: Math.round(r * 2) });
        return;
      }
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff6dc" stroke="${C.goldLight}" stroke-width="4" />`);
      const s = Math.round(r * 0.9);
      parts.push(txt(cx, cy + s * 0.36, initials, s, C.maroon, { anchor: 'middle' }));
    };
    const logoJobs: { cx: number; cy: number; box: number }[] = [];

    const fx = innerX + 18;
    const fw = innerW - 36;
    const phoneLabel = settings.phone;
    const waLabel = settings.whatsapp;

    if (g.footer === 'stacked') {
      const r = 58;
      logo(fx + r + 2, footerTop + 12 + r, r);
      const nx = fx + r * 2 + 18;
      const nAvail = fw - (nx - fx) - 30;
      const ns = fitSize(shopName, FONT, WEIGHT, 68, 22, nAvail);
      parts.push(txt(nx + nAvail / 2, footerTop + 18 + 46, shopName, ns, C.goldLight, { anchor: 'middle', spacing: 0.8 }));
      const ts = fitSize(tagline, FONT, WEIGHT, 25, 11, nAvail);
      parts.push(txt(nx + nAvail / 2, footerTop + 18 + 46 + 40, truncateToWidth(tagline, FONT, WEIGHT, ts, nAvail), ts, '#ffffff', { anchor: 'middle', spacing: 0.3 }));
      const cw = Math.floor((fw - 16) / 2);
      pill(fx, footerTop + 132, cw, 76, 'phone', phoneLabel, C.green);
      pill(fx + cw + 16, footerTop + 132, cw, 76, 'chat', waLabel, '#166534');
      addressPill(fx, footerTop + 220, fw, 56);
    } else if (g.footer === 'compact') {
      // Logo takes the full height of the plaque; everything else sits to its right.
      const r = 86;
      logo(fx + r + 2, footerTop + g.footerH / 2, r);
      const nx = fx + r * 2 + 16;
      const rw = fw - (nx - fx);
      const ns = fitSize(shopName, FONT, WEIGHT, 56, 18, rw - 10);
      parts.push(txt(nx + rw / 2, footerTop + 20 + 42, shopName, ns, C.goldLight, { anchor: 'middle', spacing: 0.6 }));
      const ts = fitSize(tagline, FONT, WEIGHT, 19, 9, rw - 10);
      parts.push(txt(nx + rw / 2, footerTop + 20 + 70, truncateToWidth(tagline, FONT, WEIGHT, ts, rw - 10), ts, '#ffffff', { anchor: 'middle', spacing: 0.3 }));
      const cw = Math.floor((rw - 12) / 2);
      pill(nx, footerTop + 100, cw, 50, 'phone', phoneLabel, C.green);
      pill(nx + cw + 12, footerTop + 100, cw, 50, 'chat', waLabel, '#166534');
      addressPill(nx, footerTop + 158, rw, 38);
    } else {
      const leftW = Math.round(fw * 0.56);
      const r = 76;
      logo(fx + r + 2, footerTop + g.footerH / 2, r);
      const nx = fx + r * 2 + 16;
      const nAvail = leftW - (nx - fx) - 10;
      const ns = fitSize(shopName, FONT, WEIGHT, 64, 22, nAvail);
      parts.push(txt(nx + nAvail / 2, footerTop + 22 + 46, shopName, ns, C.goldLight, { anchor: 'middle', spacing: 0.8 }));
      const ts = fitSize(tagline, FONT, WEIGHT, 23, 10, nAvail);
      parts.push(txt(nx + nAvail / 2, footerTop + 22 + 46 + 36, truncateToWidth(tagline, FONT, WEIGHT, ts, nAvail), ts, '#ffffff', { anchor: 'middle', spacing: 0.3 }));
      addressPill(nx, footerTop + 150, nAvail + 10, 50);
      const rx = fx + leftW + 26;
      const rw = fw - leftW - 26;
      pill(rx, footerTop + 20, rw, 80, 'phone', phoneLabel, C.green);
      pill(rx, footerTop + 114, rw, 80, 'chat', waLabel, '#166534');
    }

    // ---- frame ornaments ----
    const frame = `
      <rect x="${FR / 2}" y="${FR / 2}" width="${W - FR}" height="${H - FR}" rx="26" fill="none" stroke="${C.maroon}" stroke-width="12" />
      <rect x="${FR + 4}" y="${FR + 4}" width="${W - 2 * FR - 8}" height="${H - 2 * FR - 8}" rx="16" fill="none" stroke="${C.gold}" stroke-width="3" />
      ${[[FR / 2 + 4, FR / 2 + 4], [W - FR / 2 - 4, FR / 2 + 4], [FR / 2 + 4, H - FR / 2 - 4], [W - FR / 2 - 4, H - FR / 2 - 4]]
        .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="13" fill="${C.gold}" stroke="${C.maroon}" stroke-width="4" />`).join('')}
    `;

    if (hasLogo) {
      for (const j of logoJobs) {
        const buf = await sharp(LOGO_PHOTO).resize(j.box, j.box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        composites.push({ input: buf, left: Math.round(j.cx - j.box / 2), top: Math.round(j.cy - j.box / 2) });
      }
    }

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${C.paperA}"/><stop offset="100%" stop-color="${C.paperB}"/></linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff08a"/><stop offset="100%" stop-color="#f5b80a"/></linearGradient>
        <linearGradient id="maroonGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${C.maroon}"/><stop offset="100%" stop-color="${C.maroonDark}"/></linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#paper)" />
      ${frame}
      ${parts.join('\n')}
    </svg>`;

    const fileName = `onion-report-large-${size.replace(':', 'x')}-${(dateDisplay || 'today').replace(/\./g, '-')}-${uuidv4().substring(0, 8)}.png`;
    const absolutePath = path.join(POSTERS_DIR, fileName);
    let pipeline = sharp(Buffer.from(svg)).resize(W, H);
    if (composites.length) pipeline = pipeline.composite(composites);
    await pipeline.png({ quality: 95, compressionLevel: 8 }).toFile(absolutePath);

    return { fileName, absolutePath, urlPath: `/posters/${fileName}` };
  }
}
