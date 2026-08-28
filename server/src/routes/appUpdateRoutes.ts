import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { PUBLIC_DIR } from '../paths';

/**
 * Over-the-air update endpoint for the Android app.
 *
 * The app ships its web layer (the React bundle) inside the APK, but checks
 * here on launch for a newer one. That means UI fixes reach installed phones
 * without asking anyone to sideload another APK — native changes still need a
 * rebuild, since they are not part of the bundle.
 *
 * The contract is the Capgo updater's: POST a description of the device's
 * current bundle, receive either the next one to download or a plain
 * "nothing new". Anything other than a well-formed version/url pair is read by
 * the plugin as "no update", which is the safe direction to fail in — a phone
 * that cannot understand the answer simply keeps running what it has.
 */

const BUNDLES_DIR = path.join(PUBLIC_DIR, 'bundles');
// Lives beside the bundles, not in data/: everything in server/data is
// gitignored runtime state, and this manifest has to ship with a deploy.
const MANIFEST_FILE = path.join(BUNDLES_DIR, 'manifest.json');

interface BundleManifest {
  /** Semver of the published web bundle, e.g. "1.0.1". */
  version: string;
  /** File name inside public/bundles. */
  file: string;
  /** sha256 of the zip, or "" to skip verification. */
  checksum: string;
  publishedAt: string;
}

function readManifest(): BundleManifest | null {
  try {
    if (!fs.existsSync(MANIFEST_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8')) as BundleManifest;
    if (!parsed.version || !parsed.file) return null;
    if (!fs.existsSync(path.join(BUNDLES_DIR, parsed.file))) {
      console.warn(`Bundle manifest points at a missing file: ${parsed.file}`);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('Could not read the app bundle manifest:', err);
    return null;
  }
}

/**
 * Absolute base URL for this request, so the download link works whether the
 * app is talking to the deployed API or a laptop on the same wifi.
 */
function baseUrl(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

const router = Router();

/**
 * POST /api/app/update
 *
 * The plugin sends its current version among other device fields. GET is
 * accepted too, purely so the endpoint can be eyeballed in a browser.
 */
const handleUpdateCheck = (req: Request, res: Response): void => {
  const manifest = readManifest();
  if (!manifest) {
    res.json({ message: 'No bundle published', error: 'no_bundle' });
    return;
  }

  const current = (req.body?.version_name || req.body?.version || req.query.version || '') as string;
  if (current && current === manifest.version) {
    res.json({ message: 'Already up to date', version: manifest.version });
    return;
  }

  res.json({
    version: manifest.version,
    url: `${baseUrl(req)}/bundles/${manifest.file}`,
    checksum: manifest.checksum || undefined,
  });
};

router.post('/update', handleUpdateCheck);
router.get('/update', handleUpdateCheck);

/** Plain view of what is currently published — handy when a phone disagrees. */
router.get('/bundle', (req: Request, res: Response): void => {
  const manifest = readManifest();
  if (!manifest) {
    res.json({ published: false });
    return;
  }
  const filePath = path.join(BUNDLES_DIR, manifest.file);
  res.json({
    published: true,
    version: manifest.version,
    file: manifest.file,
    sizeBytes: fs.statSync(filePath).size,
    checksum: manifest.checksum,
    publishedAt: manifest.publishedAt,
    downloadUrl: `${baseUrl(req)}/bundles/${manifest.file}`,
  });
});

export default router;
export { BUNDLES_DIR, MANIFEST_FILE };
