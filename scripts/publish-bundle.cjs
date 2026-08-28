#!/usr/bin/env node
/**
 * Packages the built web app as an over-the-air bundle.
 *
 *   node scripts/publish-bundle.cjs [version]
 *
 * Reads client/dist, writes server/public/bundles/app-<version>.zip and points
 * server/public/bundles/manifest.json at it. Deploy the server afterwards and installed
 * phones pick the new bundle up on their next launch — no APK, no store.
 *
 * The zip is flat on purpose: the updater unpacks it *as* the web root, so
 * index.html has to sit at the top of the archive rather than inside a folder.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'client', 'dist');
const BUNDLES = path.join(ROOT, 'server', 'public', 'bundles');
const MANIFEST = path.join(BUNDLES, 'manifest.json');

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** Next patch version after whatever is published, so releases never collide. */
function nextVersion() {
  try {
    const current = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')).version;
    const parts = String(current).split('.').map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      parts[2] += 1;
      return parts.join('.');
    }
  } catch {
    /* nothing published yet */
  }
  return '1.0.1';
}

async function zipDist(version) {
  fs.mkdirSync(BUNDLES, { recursive: true });
  const file = `app-${version}.zip`;
  const target = path.join(BUNDLES, file);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(target);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('warning', reject);
    archive.on('error', reject);
    archive.pipe(output);
    // Contents of dist at the archive root — not the dist folder itself.
    archive.directory(DIST, false);
    archive.finalize();
  });

  return { file, target };
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    fail('client/dist/index.html not found. Run "npm --prefix client run build" first.');
  }

  const version = process.argv[2] || nextVersion();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`Version must look like 1.0.2 — got "${version}".`);
  }

  const { file, target } = await zipDist(version);
  const buffer = fs.readFileSync(target);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  const manifest = {
    version,
    file,
    checksum,
    publishedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  const sizeKb = (buffer.length / 1024).toFixed(0);
  console.log(`\n  Published bundle ${version}`);
  console.log(`    file      server/public/bundles/${file}  (${sizeKb} KB)`);
  console.log(`    sha256    ${checksum}`);
  console.log(`    manifest  server/public/bundles/manifest.json`);
  console.log(`\n  Commit both, deploy the server, and installed apps update on next launch.\n`);
})().catch((err) => fail(err.stack || String(err)));
