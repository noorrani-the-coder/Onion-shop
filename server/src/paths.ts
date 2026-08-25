import fs from 'fs';
import path from 'path';

/**
 * Absolute path to the `server/` package root.
 *
 * `__dirname` sits at different depths depending on how the code is run:
 *   dev  (ts-node)  -> server/src/...
 *   prod (tsc out)  -> server/dist/server/src/...   (rootDir is `..` so that
 *                      the sibling `shared/` folder is emitted alongside)
 * so anything anchored on the package root (data/, public/, assets/, .env)
 * must be resolved by walking up to the nearest package.json instead of by a
 * hard-coded number of `..` segments.
 */
function findServerRoot(start: string): string {
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

export const SERVER_ROOT = findServerRoot(__dirname);
export const DATA_DIR = path.join(SERVER_ROOT, 'data');
export const PUBLIC_DIR = path.join(SERVER_ROOT, 'public');
export const ASSETS_DIR = path.join(SERVER_ROOT, 'assets');
export const ENV_FILE = path.join(SERVER_ROOT, '.env');
