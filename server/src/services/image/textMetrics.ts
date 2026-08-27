import sharp from 'sharp';

/**
 * Real text measurement for the poster SVG.
 *
 * librsvg exposes no text-measurement API, so layout used to guess widths from
 * a flat `chars * fontSize * ratio` formula. Those ratios were calibrated
 * against the condensed faces in `assets/fonts/`, but those files are only
 * loaded when fontconfig is pointed at them *before the process starts* — so on
 * a normal run the renderer silently falls back to a much wider system sans and
 * every guess undershoots by 20-35%. Labels then ran under their rate pills.
 *
 * Instead of guessing, we render each string once to a transparent canvas and
 * trim it to its ink bounds. Widths scale linearly with font-size (verified to
 * within 0.3% from 20px to 200px), so one measurement at REF_SIZE gives the
 * width at every size. Results are cached for the life of the process, so a
 * repeated poster costs nothing.
 */

const REF_SIZE = 100;

// family|weight|text -> ink width at font-size 1
const cache = new Map<string, number>();

// Used only when a measurement could not be taken. Deliberately wide: an
// overestimate shrinks text slightly, an underestimate overlaps it.
const FALLBACK_RATIO = 0.75;

function cacheKey(text: string, family: string, weight: number | string): string {
  return `${family}|${weight}|${text}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function measure(text: string, family: string, weight: number | string): Promise<number | null> {
  // Generous canvas: even the widest face stays well inside it, so trimming
  // never clips the glyphs and never reports the canvas width by accident.
  const canvasW = Math.ceil(REF_SIZE * text.length * 2) + 200;
  const canvasH = REF_SIZE * 3;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">` +
    `<text x="100" y="${REF_SIZE * 2}" font-family="${family}" font-size="${REF_SIZE}" ` +
    `font-weight="${weight}" fill="#000">${escapeXml(text)}</text></svg>`;

  try {
    const { info } = await sharp(Buffer.from(svg))
      .trim({ threshold: 1 })
      .toBuffer({ resolveWithObject: true });
    // Nothing was trimmed => the string rendered no ink (all spaces, or the
    // glyphs are missing). Fall back rather than trust the canvas width.
    if (!info.width || info.width >= canvasW) return null;
    return info.width / REF_SIZE;
  } catch {
    return null;
  }
}

/**
 * Measures every string the poster is about to draw, so the layout pass that
 * follows can stay synchronous. Safe to call repeatedly; already-measured
 * strings are skipped.
 */
export async function warmTextMetrics(
  entries: { text: string; family: string; weight: number | string }[]
): Promise<void> {
  const pending = new Map<string, { text: string; family: string; weight: number | string }>();
  for (const e of entries) {
    if (!e.text) continue;
    const k = cacheKey(e.text, e.family, e.weight);
    if (!cache.has(k) && !pending.has(k)) pending.set(k, e);
  }
  if (pending.size === 0) return;

  const jobs = [...pending.entries()];
  const CONCURRENCY = 8;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const slice = jobs.slice(i, i + CONCURRENCY);
    const ratios = await Promise.all(slice.map(([, e]) => measure(e.text, e.family, e.weight)));
    slice.forEach(([k], j) => {
      const r = ratios[j];
      if (r !== null) cache.set(k, r);
    });
  }
}

/** Width in px of `text` at `size`, from the warmed cache (or a wide guess). */
export function widthOf(text: string, family: string, weight: number | string, size: number): number {
  if (!text) return 0;
  const r = cache.get(cacheKey(text, family, weight));
  return (r === undefined ? FALLBACK_RATIO * text.length : r) * size;
}

/**
 * Largest size in [minSize, baseSize] at which `text` fits `availableWidth`.
 * Returns minSize when even that overflows — callers must also clip or
 * truncate, never assume the returned size fits.
 */
export function fitSize(
  text: string,
  family: string,
  weight: number | string,
  baseSize: number,
  minSize: number,
  availableWidth: number
): number {
  const w = widthOf(text, family, weight, baseSize);
  if (w <= availableWidth) return baseSize;
  if (w <= 0) return baseSize;
  return Math.max(minSize, Math.floor(baseSize * (availableWidth / w)));
}

/**
 * Widths are floats scaled from a measured ratio, so a string the layout sized
 * to fit its box *exactly* can miss a strict comparison by ~1e-14 and lose its
 * last characters to an ellipsis it had room for. A hair of tolerance costs
 * nothing visually and keeps those exact fits intact.
 */
const FIT_EPSILON = 0.01;

/** Drops characters (adding an ellipsis) until `text` fits `availableWidth` at `size`. */
export function truncateToWidth(
  text: string,
  family: string,
  weight: number | string,
  size: number,
  availableWidth: number
): string {
  if (widthOf(text, family, weight, size) <= availableWidth + FIT_EPSILON) return text;
  // widthOf falls back to a per-character estimate for the shortened variants,
  // which is exactly the conservative direction we want here.
  let out = text;
  while (out.length > 1 && widthOf(out + '…', family, weight, size) > availableWidth) {
    out = out.slice(0, -1);
  }
  return out.length > 1 ? out + '…' : out;
}

/**
 * Greedily breaks `text` into at most `maxLines` lines that each fit
 * `availableWidth` at `size`.
 *
 * A word too long to fit alone is left overflowing on its own line rather than
 * broken mid-word — a caller that cannot afford the overflow should shrink the
 * size first and wrap second. Text needing more than `maxLines` has the
 * remainder folded into the last line and clipped there, so the result never
 * silently drops a word without an ellipsis to show for it.
 */
export function wrapToWidth(
  text: string,
  family: string,
  weight: number | string,
  size: number,
  availableWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let line = words[i++];
    while (i < words.length && widthOf(line + ' ' + words[i], family, weight, size) <= availableWidth) {
      line += ' ' + words[i++];
    }
    lines.push(line);
  }

  if (i < words.length) {
    const rest = lines[lines.length - 1] + ' ' + words.slice(i).join(' ');
    lines[lines.length - 1] = truncateToWidth(rest, family, weight, size, availableWidth);
  }
  return lines;
}
