/**
 * Inline SVG icon set for the poster renderer.
 *
 * Why not emoji: the poster is rasterised by sharp, whose SVG backend (librsvg)
 * has no colour-emoji support. On Windows an emoji glyph falls back to a
 * monochrome outline face; on the Linux host there is no emoji font installed
 * at all, so librsvg draws the literal codepoint in a box ("01F9C5"). These
 * vector icons carry no font dependency, so they render identically everywhere.
 *
 * Each icon is authored in a 24x24 box and scaled at draw time. Every shape
 * takes a 3-colour palette so the same geometry can render full-colour on light
 * panels or as a flat silhouette on the coloured header bars.
 */

export type IconPalette = [string, string, string];

/** Natural (full-colour) palette per icon: [primary, highlight, accent]. */
const NATURAL: Record<string, IconPalette> = {
  onion: ['#9d174d', '#f9a8d4', '#15803d'],
  wheat: ['#eab308', '#facc15', '#a16207'],
  sprout: ['#22c55e', '#16a34a', '#15803d'],
  cabbage: ['#16a34a', '#4ade80', '#bbf7d0'],
  potato: ['#b45309', '#78350f', '#78350f'],
  garlic: ['#f5f5f4', '#d6d3d1', '#a8a29e'],
  ginger: ['#ca8a04', '#854d0e', '#854d0e'],
  tomato: ['#dc2626', '#16a34a', '#fca5a5'],
  chilli: ['#dc2626', '#16a34a', '#16a34a'],
  lemon: ['#facc15', '#ca8a04', '#fef08a'],
  carrot: ['#f97316', '#c2410c', '#16a34a'],
  box: ['#b45309', '#78350f', '#78350f'],
  calendar: ['#ffffff', '#b91c1c', '#b91c1c'],
  truck: ['#dc2626', '#b91c1c', '#1f2937'],
  phone: ['#ffffff', '#ffffff', '#ffffff'],
  chat: ['#ffffff', '#ffffff', '#ffffff'],
  pin: ['#dc2626', '#ffffff', '#ffffff'],
  sun: ['#fbbf24', '#fbbf24', '#f59e0b'],
  cloud: ['#ffffff', '#e2e8f0', '#cbd5e1'],
  rain: ['#ffffff', '#38bdf8', '#38bdf8'],
  snow: ['#ffffff', '#e0f2fe', '#e0f2fe'],
};

/** Geometry per icon, authored in a 24x24 box. */
const SHAPES: Record<string, (p: IconPalette) => string> = {
  onion: ([a, b, c]) => `
    <path d="M12 6.5c3.6 1.6 6.2 4.6 6.2 8.2 0 4.2-2.8 7.3-6.2 7.3s-6.2-3.1-6.2-7.3c0-3.6 2.6-6.6 6.2-8.2z" fill="${a}"/>
    <path d="M12 7.2c1.4 1.9 2.1 4.5 2.1 7.6 0 3.3-.8 5.9-2.1 7" fill="none" stroke="${b}" stroke-width="1.1" opacity="0.85" stroke-linecap="round"/>
    <path d="M9.9 8.2C9.1 6.5 9.4 4.6 10.6 3.4M14.1 8.2c.8-1.7.5-3.6-.7-4.8" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`,

  wheat: ([a, b, c]) => `
    <path d="M12 21.5V8.5" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M12 9.2c0-2.2 1.3-4 3.2-4.8.6 2.5-.5 4.7-3.2 4.8zM12 9.2c0-2.2-1.3-4-3.2-4.8-.6 2.5.5 4.7 3.2 4.8z" fill="${a}"/>
    <path d="M12 13.8c0-2.2 1.3-4 3.2-4.8.6 2.5-.5 4.7-3.2 4.8zM12 13.8c0-2.2-1.3-4-3.2-4.8-.6 2.5.5 4.7 3.2 4.8z" fill="${b}"/>
    <path d="M12 18.4c0-2.2 1.3-4 3.2-4.8.6 2.5-.5 4.7-3.2 4.8zM12 18.4c0-2.2-1.3-4-3.2-4.8-.6 2.5.5 4.7 3.2 4.8z" fill="${a}"/>`,

  sprout: ([a, b, c]) => `
    <path d="M12 21.5v-7.2" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M12 14.6c0-3.1 2.5-5.6 5.6-5.6 0 3.1-2.5 5.6-5.6 5.6z" fill="${a}"/>
    <path d="M12 16.6c-2.7 0-4.8-2.1-4.8-4.8 2.7 0 4.8 2.1 4.8 4.8z" fill="${b}"/>`,

  cabbage: ([a, b, c]) => `
    <circle cx="12" cy="13.2" r="8" fill="${a}"/>
    <path d="M12 5.2c-3 2.1-4.7 5.1-4.7 8.1 0 3 2.1 5.1 4.7 5.1s4.7-2.1 4.7-5.1c0-3-1.7-6-4.7-8.1z" fill="${b}"/>
    <path d="M12 8.4c-1.4 1.6-2.2 3.4-2.2 5.2 0 1.8 1 3.1 2.2 3.1s2.2-1.3 2.2-3.1c0-1.8-.8-3.6-2.2-5.2z" fill="${c}"/>`,

  potato: ([a, b]) => `
    <ellipse cx="12" cy="13" rx="8" ry="6" fill="${a}" transform="rotate(-15 12 13)"/>
    <circle cx="9.2" cy="11.4" r="0.9" fill="${b}"/>
    <circle cx="13.2" cy="14.2" r="0.8" fill="${b}"/>
    <circle cx="14.6" cy="10.6" r="0.7" fill="${b}"/>`,

  garlic: ([a, b, c]) => `
    <path d="M12 7c3.4 1.9 5.6 4.7 5.6 7.9 0 3.7-2.4 6.4-5.6 6.4s-5.6-2.7-5.6-6.4C6.4 11.7 8.6 8.9 12 7z" fill="${a}"/>
    <path d="M12 7.6v13.4M9.2 9.8c-.8 1.8-1.2 3.6-1.2 5.2M14.8 9.8c.8 1.8 1.2 3.6 1.2 5.2" stroke="${b}" stroke-width="1" fill="none"/>
    <path d="M12 7c.7-1.6.5-3-.5-4.1-.7 1.4-.7 2.8.5 4.1z" fill="${c}"/>`,

  ginger: ([a, b]) => `
    <path d="M5.8 14c0-2.4 1.7-4.1 3.7-4.1 1.2 0 1.9.6 3.1.6 1.6 0 2.1-1.4 3.7-1.4 1.9 0 3.1 1.5 3.1 3.3 0 2.2-1.8 3.5-3.5 3.5-1.2 0-1.8-.5-2.9-.5-1.4 0-2.1 1.6-3.7 1.6-2 0-3.5-1.2-3.5-3z" fill="${a}"/>
    <path d="M9.2 12.6c.6.3 1 .8 1.2 1.4M15.8 12c.5.4.8 1 .9 1.6" stroke="${b}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`,

  tomato: ([a, b, c]) => `
    <circle cx="12" cy="14" r="7.4" fill="${a}"/>
    <path d="M12 8.8c-1.7-1.9-3.5-1.5-4.6-.7 1.3.2 2.1.9 2.7 1.7M12 8.8c1.7-1.9 3.5-1.5 4.6-.7-1.3.2-2.1.9-2.7 1.7" fill="${b}"/>
    <circle cx="12" cy="7.4" r="1.3" fill="${b}"/>
    <path d="M9.4 11.8c-.8.8-1.3 1.8-1.3 2.9" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,

  chilli: ([a, b]) => `
    <path d="M14.8 8.2c2.2 1.5 3.3 3.9 2.9 6.5-.5 3.2-3.3 5.4-6.4 5.4-2.6 0-4.6-1.4-5.3-3.5 2.4 1 5.1.3 6.7-1.8 1.4-1.8 1.9-4.2 2.1-6.6z" fill="${a}"/>
    <path d="M14.8 8.2c-.4-1.7.2-3.1 1.7-3.9.2 1 .1 1.9-.3 2.8 1-.5 2.1-.5 3.1.1-1.4 1-2.9 1.4-4.5 1z" fill="${b}"/>`,

  lemon: ([a, b, c]) => `
    <ellipse cx="12" cy="13.4" rx="7.6" ry="5.8" fill="${a}" transform="rotate(-20 12 13.4)"/>
    <path d="M5.9 10.2c-.9-.6-1.5-.4-1.9.1M18.1 16.6c.9.6 1.5.4 1.9-.1" stroke="${b}" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <path d="M8.8 10.8c1.6-.8 3.4-.9 5.1-.1" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,

  carrot: ([a, b, c]) => `
    <path d="M12 21.5c-2.1-3.5-3.5-6.7-3.5-8.9 0-2.2 1.5-3.7 3.5-3.7s3.5 1.5 3.5 3.7c0 2.2-1.4 5.4-3.5 8.9z" fill="${a}"/>
    <path d="M10.2 13.2h3.6M10.6 16.1h2.8" stroke="${b}" stroke-width="1" stroke-linecap="round"/>
    <path d="M12 8.9c-.6-2-2.1-3.1-3.7-3.1.4 1.9 1.7 2.9 3.7 3.1zM12 8.9c.6-2 2.1-3.1 3.7-3.1-.4 1.9-1.7 2.9-3.7 3.1z" fill="${c}"/>`,

  box: ([a, b]) => `
    <path d="M4 8.8l8-4 8 4v9.4l-8 4-8-4z" fill="${a}"/>
    <path d="M4 8.8l8 4 8-4M12 12.8v9.4" stroke="${b}" stroke-width="1.2" fill="none"/>`,

  calendar: ([a, b]) => `
    <rect x="3.6" y="5.4" width="16.8" height="15.2" rx="2.2" fill="${a}" stroke="${b}" stroke-width="1.6"/>
    <path d="M3.6 10.2h16.8" stroke="${b}" stroke-width="1.6"/>
    <path d="M8.2 3.4v3.4M15.8 3.4v3.4" stroke="${b}" stroke-width="1.9" stroke-linecap="round"/>
    <rect x="6.4" y="12.2" width="2.6" height="2.3" rx="0.5" fill="${b}"/>
    <rect x="10.7" y="12.2" width="2.6" height="2.3" rx="0.5" fill="${b}"/>
    <rect x="15" y="12.2" width="2.6" height="2.3" rx="0.5" fill="${b}"/>
    <rect x="6.4" y="16" width="2.6" height="2.3" rx="0.5" fill="${b}"/>
    <rect x="10.7" y="16" width="2.6" height="2.3" rx="0.5" fill="${b}"/>`,

  truck: ([a, b, c]) => `
    <rect x="2.4" y="7.2" width="11.2" height="9.6" rx="1" fill="${a}"/>
    <path d="M13.6 10.4h3.9l3.5 3.4v3h-7.4z" fill="${b}"/>
    <circle cx="7" cy="18.4" r="2.4" fill="${c}"/>
    <circle cx="17.2" cy="18.4" r="2.4" fill="${c}"/>
    <circle cx="7" cy="18.4" r="1" fill="${a}"/>
    <circle cx="17.2" cy="18.4" r="1" fill="${a}"/>`,

  phone: ([a]) => `
    <path d="M7.4 3.6c.7 0 1.4.4 1.7 1.1l1.2 2.6c.3.7.1 1.5-.5 2l-1 .8c.9 2 2.5 3.6 4.5 4.5l.8-1c.5-.6 1.3-.8 2-.5l2.6 1.2c.7.3 1.1 1 1.1 1.7v2.4c0 1-.9 1.8-1.9 1.7C9.3 19.5 4.5 14.7 3.8 5.5c-.1-1 .7-1.9 1.7-1.9z" fill="${a}"/>`,

  chat: ([a]) => `
    <path d="M12 3.8c-4.9 0-8.8 3.4-8.8 7.7 0 2.4 1.2 4.6 3.2 6L5.5 21l4-2c.8.2 1.6.3 2.5.3 4.9 0 8.8-3.4 8.8-7.7S16.9 3.8 12 3.8z" fill="${a}"/>`,

  pin: ([a, b]) => `
    <path d="M12 2.6c-3.7 0-6.6 3-6.6 6.6 0 4.8 6.6 12.1 6.6 12.1s6.6-7.3 6.6-12.1c0-3.6-3-6.6-6.6-6.6z" fill="${a}"/>
    <circle cx="12" cy="9.2" r="2.5" fill="${b}"/>`,

  sun: ([a, , c]) => `
    <circle cx="12" cy="12" r="5" fill="${a}"/>
    <path d="M12 1.6v3.1M12 19.3v3.1M1.6 12h3.1M19.3 12h3.1M4.7 4.7l2.2 2.2M17.1 17.1l2.2 2.2M19.3 4.7l-2.2 2.2M6.9 17.1l-2.2 2.2" stroke="${c}" stroke-width="1.9" stroke-linecap="round"/>`,

  cloud: ([a]) => `
    <path d="M7.2 18.6h10a3.9 3.9 0 0 0 .4-7.8 5.7 5.7 0 0 0-10.9-1.3 4.3 4.3 0 0 0 .5 9.1z" fill="${a}"/>`,

  rain: ([a, b]) => `
    <path d="M7.2 15.4h10a3.9 3.9 0 0 0 .4-7.8A5.7 5.7 0 0 0 6.7 6.3a4.3 4.3 0 0 0 .5 9.1z" fill="${a}"/>
    <path d="M8.6 17.6l-1 3M12.4 17.6l-1 3M16.2 17.6l-1 3" stroke="${b}" stroke-width="1.7" stroke-linecap="round"/>`,

  snow: ([a, b]) => `
    <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" stroke="${a}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M9.4 4.6L12 7.2l2.6-2.6M9.4 19.4L12 16.8l2.6 2.6" stroke="${b}" stroke-width="1.5" stroke-linecap="round" fill="none"/>`,
};

/**
 * Emits one icon as an SVG group whose top-left sits at (x, y).
 * Pass `mono` (a colour) to draw a flat silhouette instead of the natural
 * palette — used on the saturated header/contact bars where the full-colour
 * version would not hold contrast.
 */
export function renderIcon(name: string, x: number, y: number, size: number, mono?: string): string {
  const shape = SHAPES[name] ?? SHAPES.box;
  const palette: IconPalette = mono ? [mono, mono, mono] : (NATURAL[name] ?? NATURAL.box);
  const scale = size / 24;
  return `<g transform="translate(${x}, ${y}) scale(${scale.toFixed(4)})">${shape(palette)}</g>`;
}

/** Maps a commodity name to an icon key (was an emoji literal). */
export function commodityIconName(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('ONION') || n.includes('EB') || n.includes('BIG') || n.includes('GOLTA') || n.includes('CHOPDA') || n.includes('MUKKAL') || n.includes('MEDIUM')) return 'onion';
  if (n.includes('POTATO') || n.includes('AALU') || n.includes('ALOO')) return 'potato';
  if (n.includes('GARLIC') || n.includes('LEHSUN') || n.includes('BELLULLI')) return 'garlic';
  if (n.includes('GINGER') || n.includes('ADRAK') || n.includes('SHUNTHI')) return 'ginger';
  if (n.includes('TOMATO')) return 'tomato';
  if (n.includes('CHILLI') || n.includes('MIRCHI')) return 'chilli';
  if (n.includes('LEMON') || n.includes('NIMBU')) return 'lemon';
  if (n.includes('CARROT') || n.includes('GAJAR')) return 'carrot';
  if (n.includes('CABBAGE')) return 'cabbage';
  return 'box';
}

/** Maps free-text weather to an icon key (was an emoji literal). */
export function weatherIconName(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('rain') || t.includes('storm')) return 'rain';
  if (t.includes('sun') || t.includes('clear') || t.includes('hot')) return 'sun';
  if (t.includes('cold') || t.includes('cool')) return 'snow';
  return 'cloud';
}
