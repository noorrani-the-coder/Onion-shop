import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { ArrivalsBoardData, ShopSettings } from '../../../../../shared/types';
import { ASSETS_DIR, PUBLIC_DIR as SERVER_PUBLIC_DIR } from '../../../paths';
import { planBoard, BoardPlan, CANVAS_W, MARGIN, CONTENT_W, BORDER } from './layout';
import { commodityIconName } from '../icons';
import { warmCommodityPhotos } from '../commodityPhotos';
import {
  BoardTheme,
  DEFAULT_THEME,
  renderDateBar,
  renderHeader,
  renderMarketHeader,
  renderProductRow,
  renderTotalVehicles,
  renderBranding,
  BRAND_LOGO,
} from './components';

/**
 * Final render stage for the arrivals board.
 *
 * By the time anything here runs the layout pass has already decided every
 * dimension, so this file only walks the plan in order and concatenates the
 * fragments the components return. It is deliberately the only place that knows
 * about the filesystem or about sharp.
 */

const POSTERS_DIR = path.join(SERVER_PUBLIC_DIR, 'posters');

function ensurePostersDir(): void {
  if (!fs.existsSync(POSTERS_DIR)) {
    fs.mkdirSync(POSTERS_DIR, { recursive: true });
  }
}

/** Composes the whole board into one SVG document. */
export function buildBoardSvg(
  data: ArrivalsBoardData,
  plan: BoardPlan,
  settings: ShopSettings | null,
  hasLogo: boolean,
  theme: BoardTheme = DEFAULT_THEME
): string {
  const sections = plan.markets
    .map((market, marketIndex) => {
      const rows = market.rows
        .map((row, rowIndex) => renderProductRow(row, plan.columns, rowIndex, theme))
        .join('\n');
      return `
    <g id="market-${marketIndex}">
      ${renderMarketHeader(market, theme)}
      ${rows}
      <rect x="${MARGIN}" y="${market.y}" width="${CONTENT_W}" height="${market.h}" fill="none"
            stroke="${theme.rowLine}" stroke-width="${BORDER}" />
    </g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${plan.canvasW}" height="${plan.canvasH}" viewBox="0 0 ${plan.canvasW} ${plan.canvasH}">
  <rect x="0" y="0" width="${plan.canvasW}" height="${plan.canvasH}" fill="${theme.paper}" />
  ${renderHeader(plan, data.committeeName, data.location, theme)}
  ${renderDateBar(plan, data.reportDateDisplay || '', data.weekday, theme)}
  ${sections}
  ${renderTotalVehicles(plan.total, theme)}
  ${settings ? renderBranding(plan, settings, theme, hasLogo) : ''}
</svg>`;
}

export interface RenderedBoard {
  fileName: string;
  absolutePath: string;
  urlPath: string;
  width: number;
  height: number;
}

export class ArrivalsBoardGenerator {
  /**
   * Measures, composes and writes one arrivals board PNG.
   *
   * The returned height is whatever the data needed — callers should not assume
   * a fixed canvas, and must not ask for one.
   */
  public static async generate(
    data: ArrivalsBoardData,
    settings: ShopSettings | null = null,
    theme: BoardTheme = DEFAULT_THEME
  ): Promise<RenderedBoard> {
    if (data.markets.length === 0) {
      throw new Error('An arrivals board needs at least one market.');
    }
    if (data.markets.every(m => m.products.length === 0)) {
      throw new Error('An arrivals board needs at least one product row.');
    }

    ensurePostersDir();

    // The shop's mark is composited over the branding band the SVG drew,
    // the same arrangement the rate poster uses.
    const logoPhoto = path.join(ASSETS_DIR, 'photos', 'logo.png');
    const hasLogo = Boolean(settings) && fs.existsSync(logoPhoto);

    // Trim the blank margin off any commodity photos this board will use, so
    // the components can drop them straight into the cell.
    await warmCommodityPhotos(
      data.markets.flatMap(m => m.products.map(p => commodityIconName(p.name)))
    );

    const plan = await planBoard(data);
    const svg = buildBoardSvg(data, plan, settings, hasLogo, theme);

    const datePart = (data.reportDateDisplay || data.reportDate || 'undated').replace(/[^0-9a-zA-Z-]/g, '-');
    const fileName = `apmc-arrivals-${datePart}-${uuidv4().slice(0, 8)}.png`;
    const absolutePath = path.join(POSTERS_DIR, fileName);

    // The mark is a photograph, so it is composited rather than drawn: an SVG
    // cannot embed it without inlining the whole file as base64.
    const LOGO = BRAND_LOGO;
    let pipeline = sharp(Buffer.from(svg));
    if (hasLogo) {
      const mask = Buffer.from(
        `<svg width="${LOGO}" height="${LOGO}"><circle cx="${LOGO / 2}" cy="${LOGO / 2}" r="${LOGO / 2}" fill="#fff"/></svg>`
      );
      const meta = await sharp(logoPhoto).metadata();
      const side = Math.round(Math.min(meta.width || 1000, meta.height || 1000) * 0.6);
      const round = await sharp(logoPhoto)
        .extract({
          left: Math.round(((meta.width || 1000) - side) / 2),
          top: Math.round((meta.height || 1000) * 0.06),
          width: side,
          height: side,
        })
        .resize(LOGO, LOGO, { fit: 'cover' })
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer();
      pipeline = pipeline.composite([
        { input: round, left: Math.round((CANVAS_W - BRAND_LOGO) / 2), top: plan.brandingY + 22 },
      ]);
    }

    await pipeline.png({ compressionLevel: 9 }).toFile(absolutePath);

    return {
      fileName,
      absolutePath,
      urlPath: `/posters/${fileName}`,
      width: plan.canvasW,
      height: plan.canvasH,
    };
  }
}

export { CANVAS_W };
