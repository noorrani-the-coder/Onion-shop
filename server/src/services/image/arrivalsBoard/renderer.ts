import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { ArrivalsBoardData } from '../../../../../shared/types';
import { PUBLIC_DIR as SERVER_PUBLIC_DIR } from '../../../paths';
import { planBoard, BoardPlan, CANVAS_W, MARGIN, CONTENT_W, BORDER } from './layout';
import {
  BoardTheme,
  DEFAULT_THEME,
  renderDateBar,
  renderHeader,
  renderMarketHeader,
  renderProductRow,
  renderTotalVehicles,
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.canvasW}" height="${plan.canvasH}" viewBox="0 0 ${plan.canvasW} ${plan.canvasH}">
  <rect x="0" y="0" width="${plan.canvasW}" height="${plan.canvasH}" fill="${theme.paper}" />
  ${renderHeader(plan, data.committeeName, data.location, theme)}
  ${renderDateBar(plan, data.reportDateDisplay || '', data.weekday, theme)}
  ${sections}
  ${renderTotalVehicles(plan.total, theme)}
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
    theme: BoardTheme = DEFAULT_THEME
  ): Promise<RenderedBoard> {
    if (data.markets.length === 0) {
      throw new Error('An arrivals board needs at least one market.');
    }
    if (data.markets.every(m => m.products.length === 0)) {
      throw new Error('An arrivals board needs at least one product row.');
    }

    ensurePostersDir();

    const plan = await planBoard(data);
    const svg = buildBoardSvg(data, plan, theme);

    const datePart = (data.reportDateDisplay || data.reportDate || 'undated').replace(/[^0-9a-zA-Z-]/g, '-');
    const fileName = `apmc-arrivals-${datePart}-${uuidv4().slice(0, 8)}.png`;
    const absolutePath = path.join(POSTERS_DIR, fileName);

    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(absolutePath);

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
