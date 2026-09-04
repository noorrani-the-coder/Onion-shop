import fs from 'fs';
import path from 'path';
import './fontconfig';
import sharp from 'sharp';
import { ASSETS_DIR } from '../../paths';

/**
 * Real photographs for the arrivals-board commodity cells.
 *
 * The vector set in `icons.ts` renders identically everywhere and is the
 * fallback; this module lets a shop replace any of those drawings with an
 * actual photo. Drop a cutout (transparent background, roughly square) into
 * `server/assets/photos/commodities/` named for the icon key —
 *
 *   onion.png  potato.png  garlic.png  ginger.png
 *   tomato.png chilli.png  lemon.png   carrot.png  cabbage.png
 *
 * and it is embedded straight into the board SVG as a base64 `<image>`. No
 * file, no change: the board falls back to the vector icon.
 *
 * On the way in each photo has its blank margin trimmed, so a shot with the
 * subject floating in a sea of padding still fills its cell as tightly as one
 * shot edge to edge. Trimming needs sharp, so it happens in the async
 * `warmCommodityPhotos` before a render; `commodityPhotoDataUri` stays
 * synchronous for the render path and hands back the raw file if warming was
 * skipped.
 */

const PHOTO_DIR = path.join(ASSETS_DIR, 'photos', 'commodities');
const EXTENSIONS = ['png', 'jpg', 'jpeg'] as const;

/**
 * iconKey -> data URI (trimmed when warmed, raw otherwise), or `null` once we
 * have looked and found no file. Cached for the life of the process: the files
 * do not change under a running server.
 */
const cache = new Map<string, string | null>();

function findFile(iconKey: string): { file: string; ext: (typeof EXTENSIONS)[number] } | null {
  for (const ext of EXTENSIONS) {
    const file = path.join(PHOTO_DIR, `${iconKey}.${ext}`);
    if (fs.existsSync(file)) return { file, ext };
  }
  return null;
}

function rawDataUri(file: string, ext: string): string {
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/**
 * Trims the blank border off each named photo and caches it as a PNG data URI.
 * Call once before a board render; safe to call repeatedly and cheap after the
 * first pass.
 */
export async function warmCommodityPhotos(iconKeys: string[]): Promise<void> {
  const pending = [...new Set(iconKeys)].filter(k => !cache.has(k));
  await Promise.all(
    pending.map(async key => {
      const hit = findFile(key);
      if (!hit) {
        cache.set(key, null);
        return;
      }
      try {
        // `trim` drops a uniform border of any colour or of transparency, so
        // this handles both a real cutout and a photo left on a flat backdrop.
        // Then cap the pixel size: these render at ~40-220px, and a data URI is
        // repeated once per row it appears on, so a multi-megabyte source would
        // blow past librsvg's SVG buffer limit.
        const trimmed = await sharp(hit.file)
          .trim({ threshold: 18 })
          .resize(384, 384, { fit: 'inside', withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
        cache.set(key, `data:image/png;base64,${trimmed.toString('base64')}`);
      } catch {
        // Corrupt or unreadable — fall back to the bytes on disk.
        cache.set(key, rawDataUri(hit.file, hit.ext));
      }
    })
  );
}

/**
 * A commodity photo as a data URI ready to drop into an SVG `<image>`, or
 * `null` when the shop has not supplied one for this commodity.
 */
export function commodityPhotoDataUri(iconKey: string): string | null {
  const cached = cache.get(iconKey);
  if (cached !== undefined) return cached;

  const hit = findFile(iconKey);
  const uri = hit ? rawDataUri(hit.file, hit.ext) : null;
  cache.set(iconKey, uri);
  return uri;
}
