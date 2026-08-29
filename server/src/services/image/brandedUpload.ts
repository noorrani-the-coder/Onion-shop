// Must precede the sharp import - see fontconfig.ts.
import './fontconfig';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { ShopSettings } from '../../../../shared/types';
import { ASSETS_DIR as SERVER_ASSETS_DIR, PUBLIC_DIR } from '../../paths';
import { widthOf, fitSize, warmTextMetrics, wrapToWidth } from './textMetrics';
import { renderIcon } from './icons';

/**
 * Wraps an image somebody forwarded to the shop in the shop's own identity.
 *
 * The picture in the middle is evidence — an arrivals board, a rate sheet — and
 * its whole value is that it is unaltered, so it is never cropped, never
 * covered and never stretched. The shop's mark and name go in a band above it,
 * its address and number in a band below: added to the canvas, never painted
 * over what the sender wrote.
 */

const CANVAS_W = 1080;
/**
 * 9:16 is a floor, not a frame. Fitting a forwarded board inside a fixed box
 * means letterboxing it, and the bands come out of the image's width —
 * shrinking the four-digit bag counts that are the only reason anyone opens it.
 * The image spans the full width and the canvas takes whatever height follows.
 */
const CANVAS_H_MIN = 1920;

const HEADER_H = 268;
const FOOTER_H = 252;

const FONT_DISPLAY = "'Montserrat', 'Arial Black', Impact, sans-serif";
const DISPLAY_WEIGHT = 800;

const LOGO_PHOTO = path.join(SERVER_ASSETS_DIR, 'photos', 'logo.png');
const POSTERS_DIR = path.join(PUBLIC_DIR, 'posters');

/**
 * Header logo geometry, shared by the SVG band and the sharp composite that
 * lays the photo onto it. Kept in one place for the reason the poster's logo
 * had to be: two code paths drawing the same badge from separate copies of the
 * numbers is how the photo ends up sitting off its own ring.
 */
const LOGO_SIZE = 214;
const LOGO_X = 22;
const LOGO_TOP = 27;
const TEXT_X = LOGO_X + LOGO_SIZE + 26;

const COLORS = {
  band: '#4a0d0d',
  bandEdge: '#7f1d1d',
  gold: '#fcd34d',
  rule: '#fcd34d',
  text: '#ffffff',
  paper: '#f7f1de',
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface BrandedUploadResult {
  fileName: string;
  absolutePath: string;
  urlPath: string;
  width: number;
  height: number;
  /** What the source measured before scaling, for diagnostics. */
  source: { width: number; height: number; format: string };
}

/**
 * Cleans up a forwarded screenshot as far as is honest.
 *
 * This only ever resizes and sharpens: nothing cropped, nothing rearranged,
 * nothing added to or removed from what the sender wrote. Sharpening genuinely
 * recovers text edges that JPEG compression softened; it cannot recover detail
 * that was destroyed, so an out-of-focus photo comes back out of focus, only
 * larger. There is deliberately no denoise pass — on digits this small it
 * smears more than it saves.
 */
async function enhance(input: Buffer, targetW: number): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const srcW = meta.width || targetW;

  let pipeline = sharp(input).rotate(); // honour EXIF orientation from phone cameras
  if (srcW !== targetW) {
    pipeline = pipeline.resize({ width: targetW, kernel: 'lanczos3', withoutEnlargement: false });
  }
  return pipeline.sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 }).png().toBuffer();
}

/** Top band: the shop's mark and name, above the forwarded image. */
function headerSvg(settings: ShopSettings, hasLogo: boolean): string {
  const name = (settings.shopName || '').toUpperCase();
  const tagline = (settings.footerTagline || 'MERCHANTS & COMMISSION AGENTS').toUpperCase();

  const x = hasLogo ? TEXT_X : 32;
  const avail = CANVAS_W - x - 28;

  /**
   * `widthOf` measures glyphs, and neither letter-spacing nor a stroke is a
   * glyph — both widen what is actually drawn without changing what was
   * measured. On a 66-character tagline, 1.2px of tracking is nearly 80px of
   * invisible overflow, which is exactly how "DAILY FRESH SUPPLY" lost its
   * last word off the right edge. Charge both against the space before fitting.
   */
  const NAME_TRACKING = 0.5;
  const NAME_STROKE = 1.8;
  const TAG_TRACKING = 1.2;
  const nameAvail = avail - name.length * NAME_TRACKING - NAME_STROKE * 2;
  const taglineAvail = avail - tagline.length * TAG_TRACKING;

  const nameSize = fitSize(name, FONT_DISPLAY, DISPLAY_WEIGHT, 86, 30, nameAvail);
  const taglineSize = fitSize(tagline, FONT_DISPLAY, DISPLAY_WEIGHT, 34, 15, taglineAvail);

  const nameBaseline = HEADER_H / 2 + 6;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${HEADER_H}">
  <defs>
    <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.bandEdge}" />
      <stop offset="100%" stop-color="${COLORS.band}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${CANVAS_W}" height="${HEADER_H}" fill="url(#bandGrad)" />
  <rect x="0" y="${HEADER_H - 7}" width="${CANVAS_W}" height="7" fill="${COLORS.rule}" />

  <text x="${x}" y="${nameBaseline}" font-family="${FONT_DISPLAY}" font-size="${nameSize}"
        font-weight="${DISPLAY_WEIGHT}" fill="${COLORS.gold}" letter-spacing="0.5"
        stroke="${COLORS.gold}" stroke-width="1.8" paint-order="stroke"
        stroke-linejoin="round">${escapeXml(name)}</text>
  <text x="${x}" y="${nameBaseline + taglineSize + 24}" font-family="${FONT_DISPLAY}"
        font-size="${taglineSize}" font-weight="${DISPLAY_WEIGHT}" fill="${COLORS.text}"
        letter-spacing="1.2">${escapeXml(tagline)}</text>
</svg>`;
}

/** Bottom band: where the shop is, and the number to call. */
function footerSvg(settings: ShopSettings): string {
  const address = settings.apmcAddress || '';
  const phone = settings.phone || '';

  /**
   * The number and the address each get their own full-width row.
   *
   * Side by side they cannot both be large: a 55-character APMC address next to
   * a 56px phone number does not fit across 1080px, and the address lost first —
   * squeezed to 29px and still clipped to "Yeshwanthpur, Bengalur…". A truncated
   * address is a customer who cannot find the shop, so each gets a row instead.
   */
  const GUTTER = 32;

  const phoneIcon = 54;
  const phoneSize = fitSize(phone, FONT_DISPLAY, DISPLAY_WEIGHT, 58, 30, CANVAS_W - GUTTER * 2 - phoneIcon - 18);
  const phoneW = widthOf(phone, FONT_DISPLAY, DISPLAY_WEIGHT, phoneSize);
  const phoneX = Math.round((CANVAS_W - (phoneIcon + 18 + phoneW)) / 2);

  const addrIcon = 40;
  const addrX = GUTTER + addrIcon + 14;
  const addrAvail = CANVAS_W - addrX - GUTTER;
  /**
   * Sized for the two lines it will actually occupy, not the one line `fitSize`
   * assumes: measuring the whole address against a single line's width collapses
   * it to the floor while the second line sits empty. Fit against the pair, then
   * step down only if a wrapped line still spills.
   */
  const ADDR_LINES = 2;
  let addrSize = fitSize(address, FONT_DISPLAY, DISPLAY_WEIGHT, 38, 20, addrAvail * ADDR_LINES - 40);
  let lines = wrapToWidth(address, FONT_DISPLAY, DISPLAY_WEIGHT, addrSize, addrAvail, ADDR_LINES);
  while (
    addrSize > 20 &&
    lines.some(line => widthOf(line, FONT_DISPLAY, DISPLAY_WEIGHT, addrSize) > addrAvail)
  ) {
    addrSize -= 2;
    lines = wrapToWidth(address, FONT_DISPLAY, DISPLAY_WEIGHT, addrSize, addrAvail, ADDR_LINES);
  }

  const phoneBaseline = 82;
  const addrTop = 116;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${FOOTER_H}">
  <rect x="0" y="0" width="${CANVAS_W}" height="${FOOTER_H}" fill="${COLORS.band}" />
  <rect x="0" y="0" width="${CANVAS_W}" height="7" fill="${COLORS.rule}" />

  ${renderIcon('phone', phoneX, phoneBaseline - phoneIcon + 10, phoneIcon, COLORS.gold)}
  <text x="${phoneX + phoneIcon + 18}" y="${phoneBaseline}" font-family="${FONT_DISPLAY}"
        font-size="${phoneSize}" font-weight="${DISPLAY_WEIGHT}" fill="${COLORS.text}">${escapeXml(phone)}</text>

  ${renderIcon('pin', GUTTER, addrTop + (lines.length > 1 ? 16 : 0), addrIcon, COLORS.gold)}
  ${lines
    .map(
      (line, i) =>
        `<text x="${addrX}" y="${addrTop + addrSize + i * (addrSize + 10)}" font-family="${FONT_DISPLAY}" font-size="${addrSize}" font-weight="${DISPLAY_WEIGHT}" fill="${COLORS.text}">${escapeXml(line)}</text>`
    )
    .join('\n  ')}
</svg>`;
}

export class BrandedUploadGenerator {
  /**
   * Frames `imageBuffer` between the shop's header and footer bands.
   *
   * The image keeps its aspect ratio and every pixel of its content; the canvas
   * takes whatever height it needs, floored at 9:16.
   */
  public static async generate(imageBuffer: Buffer, settings: ShopSettings): Promise<BrandedUploadResult> {
    const meta = await sharp(imageBuffer).metadata();
    if (!meta.width || !meta.height) {
      throw new Error('That file does not look like an image.');
    }

    await warmTextMetrics(
      [
        settings.shopName?.toUpperCase(),
        (settings.footerTagline || 'MERCHANTS & COMMISSION AGENTS').toUpperCase(),
        settings.phone,
        settings.apmcAddress,
      ]
        .filter((t): t is string => Boolean(t))
        .map(text => ({ text, family: FONT_DISPLAY, weight: DISPLAY_WEIGHT }))
    );

    const enhanced = await enhance(imageBuffer, CANVAS_W);
    const enhancedMeta = await sharp(enhanced).metadata();
    const imageH = enhancedMeta.height || Math.round((meta.height / meta.width) * CANVAS_W);
    const canvasH = Math.max(CANVAS_H_MIN, HEADER_H + imageH + FOOTER_H);

    const hasLogo = fs.existsSync(LOGO_PHOTO);
    const composites: sharp.OverlayOptions[] = [
      { input: Buffer.from(headerSvg(settings, hasLogo)), left: 0, top: 0 },
      { input: enhanced, left: 0, top: HEADER_H },
      { input: Buffer.from(footerSvg(settings)), left: 0, top: canvasH - FOOTER_H },
    ];

    if (hasLogo) {
      const mask = Buffer.from(
        `<svg width="${LOGO_SIZE}" height="${LOGO_SIZE}"><circle cx="${LOGO_SIZE / 2}" cy="${LOGO_SIZE / 2}" r="${LOGO_SIZE / 2}" fill="#fff"/></svg>`
      );
      const logoMeta = await sharp(LOGO_PHOTO).metadata();
      const side = Math.round(Math.min(logoMeta.width || 1000, logoMeta.height || 1000) * 0.6);
      const round = await sharp(LOGO_PHOTO)
        .extract({
          left: Math.round(((logoMeta.width || 1000) - side) / 2),
          top: Math.round((logoMeta.height || 1000) * 0.06),
          width: side,
          height: side,
        })
        .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'cover' })
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer();
      composites.push({ input: round, left: LOGO_X, top: LOGO_TOP });
    }

    const canvas = sharp({
      create: { width: CANVAS_W, height: canvasH, channels: 4, background: COLORS.paper },
    }).composite(composites);

    if (!fs.existsSync(POSTERS_DIR)) fs.mkdirSync(POSTERS_DIR, { recursive: true });
    const fileName = `branded-upload-${uuidv4().slice(0, 8)}.png`;
    const absolutePath = path.join(POSTERS_DIR, fileName);
    await canvas.png({ compressionLevel: 9 }).toFile(absolutePath);

    return {
      fileName,
      absolutePath,
      urlPath: `/posters/${fileName}`,
      width: CANVAS_W,
      height: canvasH,
      source: { width: meta.width, height: meta.height, format: meta.format || 'unknown' },
    };
  }
}
