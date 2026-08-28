import fs from 'fs';
import os from 'os';
import path from 'path';
import { Router, Request, Response } from 'express';
import '../services/image/fontconfig';
import sharp from 'sharp';
import { ASSETS_DIR } from '../paths';
import { FONTS_DIR } from '../services/image/fontconfig';

/**
 * Reports which fonts this machine actually resolves.
 *
 * A poster that renders in the wrong face still renders, so the failure is
 * silent and only visible by eye — and only to someone comparing two machines.
 * This endpoint makes it checkable: it draws the same string in each family the
 * poster asks for and returns the measured ink width. Families that resolve to
 * the same width as `sans-serif` are not installed, whatever their name says.
 */

const router = Router();

const PROBE = 'AVERAGE QUALITY';

async function inkWidth(family: string, weight: number): Promise<number | null> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="300">` +
    `<text x="50" y="200" font-family="${family}" font-weight="${weight}" font-size="100" fill="#000">${PROBE}</text></svg>`;
  try {
    const { info } = await sharp(Buffer.from(svg)).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    return info.width ?? null;
  } catch {
    return null;
  }
}

router.get('/fonts', async (_req: Request, res: Response): Promise<void> => {
  const userFontDirs = [
    path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'fonts', 'apmc-poster'),
    path.join(os.homedir(), '.fonts', 'apmc-poster'),
  ];

  const probes: Record<string, number | null> = {};
  for (const [label, family, weight] of [
    ['montserrat800', "'Montserrat'", 800],
    ['anton400', "'Anton'", 400],
    ['robotoCondensed700', "'Roboto Condensed'", 700],
    ['arialBlack400', "'Arial Black'", 400],
    ['sansSerif400', 'sans-serif', 400],
  ] as [string, string, number][]) {
    probes[label] = await inkWidth(family, weight);
  }

  res.json({
    platform: `${os.platform()} ${os.arch()}`,
    home: os.homedir(),
    assetsDir: ASSETS_DIR,
    bundledFontsDir: FONTS_DIR,
    bundledFontsPresent: fs.existsSync(FONTS_DIR) ? fs.readdirSync(FONTS_DIR) : [],
    fontconfigFile: process.env.FONTCONFIG_FILE || null,
    userFontDirs: userFontDirs.map(dir => ({
      dir,
      exists: fs.existsSync(dir),
      files: fs.existsSync(dir) ? fs.readdirSync(dir) : [],
    })),
    // A family whose width equals sansSerif400 did not resolve.
    inkWidths: probes,
  });
});

export default router;
