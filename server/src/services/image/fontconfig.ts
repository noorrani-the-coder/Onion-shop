import fs from 'fs';
import os from 'os';
import path from 'path';
import { ASSETS_DIR } from '../../paths';

/**
 * Makes the poster's bundled fonts visible to the renderer.
 *
 * librsvg finds fonts through fontconfig, and fontconfig reads its
 * configuration **once, when it is first used** — which happens the moment
 * anything touches sharp. So this module has side effects at import time and
 * must be imported before sharp anywhere that draws or measures text.
 *
 * Without it the font stacks silently degrade to whatever the host happens to
 * have. That is not a cosmetic difference: on Windows
 * `'Anton', 'Arial Black', Impact` resolves to Arial Black and the poster looks
 * heavy, while on a bare Linux server none of the three exist, the text renders
 * in a thin default at different widths, and labels that fit locally get
 * truncated in production. Pointing fontconfig at assets/fonts makes both
 * environments draw the same poster from the same three files.
 */

const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');

/**
 * Copies the bundled faces into the per-user font directory fontconfig scans by
 * default.
 *
 * This is the belt to the config file's braces, and on some hosts it is the
 * only one that holds: assigning to `process.env` after startup does not always
 * reach a native library's view of the environment, so a font that is simply
 * *there* in a directory fontconfig already searches needs no environment at
 * all. Copying before fontconfig initialises is what makes it visible.
 */
function installFontsForUser(): void {
  const home = os.homedir();
  if (!home) return;

  const targets = [
    path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'fonts', 'apmc-poster'),
    path.join(home, '.fonts', 'apmc-poster'),
  ];

  for (const target of targets) {
    try {
      fs.mkdirSync(target, { recursive: true });
      for (const file of fs.readdirSync(FONTS_DIR)) {
        if (!/\.(ttf|otf)$/i.test(file)) continue;
        const dest = path.join(target, file);
        const src = path.join(FONTS_DIR, file);
        // Skip an identical copy so restarts stay cheap and never half-write a
        // font file that fontconfig might be reading.
        if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) continue;
        fs.copyFileSync(src, dest);
      }
    } catch {
      // Read-only home, or no permission. The config file below may still work.
    }
  }
}

function configureFonts(): void {
  if (!fs.existsSync(FONTS_DIR)) {
    console.warn(`Poster fonts directory not found at ${FONTS_DIR}; falling back to system fonts.`);
    return;
  }

  installFontsForUser();

  // Already configured (a second import, or the host set it deliberately).
  if (process.env.FONTCONFIG_FILE) return;

  try {
    const cacheDir = path.join(os.tmpdir(), 'apmc-poster-fontcache');
    fs.mkdirSync(cacheDir, { recursive: true });

    // The system config is included so emoji and generic fallbacks still work
    // where they exist; ignore_missing keeps this harmless on Windows.
    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${FONTS_DIR}</dir>
  <cachedir>${cacheDir}</cachedir>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
</fontconfig>
`;
    const confPath = path.join(cacheDir, 'fonts.conf');
    fs.writeFileSync(confPath, conf, 'utf-8');

    process.env.FONTCONFIG_FILE = confPath;
    process.env.FONTCONFIG_PATH = cacheDir;
  } catch (err) {
    // A poster in the wrong font beats no poster at all.
    console.warn('Could not configure poster fonts; falling back to system fonts:', err);
  }
}

configureFonts();

export { FONTS_DIR };
