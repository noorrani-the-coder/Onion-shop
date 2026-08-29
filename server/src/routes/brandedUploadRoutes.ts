import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { BrandedUploadGenerator } from '../services/image/brandedUpload';
import { db } from '../database/db';
import { MarketReportNormalized } from '../../../shared/types';

/**
 * Upload an image, get it back wrapped in the shop's header and footer.
 *
 * The file is held in memory and never written to disk: it goes straight into
 * sharp and is dropped when the request ends. Only the rendered result is kept,
 * which keeps a forwarded screenshot from lingering on the server and sidesteps
 * the host's disk being wiped on every deploy.
 */

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The record shape History expects, with nothing claimed that a branded upload
 * does not know.
 *
 * A parsed report carries rates, arrivals and confidence scores; an uploaded
 * picture carries none of that, and inventing plausible-looking zeros would put
 * numbers in the history that no report ever stated. Every field is empty and
 * `sourceKind` says why, so the screens can render it as what it is.
 */
function brandedPlaceholder(): MarketReportNormalized {
  const noRate = { extraBig: null, big: null, mukkal: null, medium: null, golta: null, golty: null, chopda: null, averageQuality: null };
  const unknown = 'low' as const;
  return {
    sourceKind: 'branded-upload',
    reportDate: new Date().toISOString().slice(0, 10),
    reportDateDisplay: null,
    market: null,
    totalArrivals: null,
    truckCount: null,
    maharashtra: noRate,
    vijayapura: { rate: null },
    newOnions: { state: null, bagCount: null, rate: null, lotRate: null },
    commodities: [],
    salesStatus: null,
    weather: null,
    rateUnit: null,
    additionalInformation: [],
    confidence: {
      overall: unknown, date: unknown, market: unknown, arrivals: unknown,
      maharashtra: unknown, vijayapura: unknown, newOnions: unknown,
      salesStatus: unknown, weather: unknown,
    },
    missingFields: [],
    warnings: [],
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type ${file.mimetype}. Send a JPEG, PNG or WebP.`));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

/**
 * Turns multer's rejections into the JSON the caller is expecting.
 *
 * Without this, an oversized or wrong-typed file escapes to Express's default
 * handler and comes back as a 500 HTML error page — which tells the app that
 * the server broke, when in fact the upload was refused on purpose. These are
 * the caller's mistakes, so they get 4xx and a sentence explaining the rule.
 */
function handleUploadErrors(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!err) {
    next();
    return;
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooBig ? 413 : 400).json({
      success: false,
      error: tooBig ? 'That image is over the 10 MB limit.' : `Upload rejected: ${err.message}`,
    });
    return;
  }
  res.status(415).json({ success: false, error: (err as Error).message || 'Unsupported upload.' });
}

const acceptImage = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('image')(req, res, (err: unknown) => handleUploadErrors(err, req, res, next));
};

router.post('/generate', acceptImage, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file?.buffer?.length) {
      res.status(400).json({ success: false, error: 'No image was uploaded (field name must be "image").' });
      return;
    }

    const settings = await db.getSettings();
    const out = await BrandedUploadGenerator.generate(req.file.buffer, settings);

    // Saved alongside posters so History is one place, with sourceKind marking
    // what it is: a branded upload carries no rates, so the screens that read
    // maharashtra/arrivals must not treat it as a parsed report.
    const record = await db.createOrUpdateReport({
      rawMessage: req.file.originalname || 'Uploaded image',
      extractedData: brandedPlaceholder(),
      editedData: brandedPlaceholder(),
      imagePath: out.urlPath,
      reportDate: new Date().toISOString().slice(0, 10),
    });

    res.json({
      success: true,
      reportId: record.id,
      imageUrl: out.urlPath,
      width: out.width,
      height: out.height,
      source: out.source,
    });
  } catch (err: any) {
    console.error('Branded upload failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Could not brand that image.' });
  }
});

/**
 * A bare page for trying the above by hand, before the app screen exists.
 * Deliberately dependency-free so it works anywhere the API does.
 */
router.get('/try', (_req: Request, res: Response): void => {
  res.type('html').send(`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brand an image</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #12203a; color: #e6edf7; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  .card { max-width: 720px; margin: 0 auto; background: #17263f; border: 1px solid #2c3f63;
          border-radius: 14px; padding: 20px; }
  input[type=file] { width: 100%; padding: 14px; background: #0f1b30; border: 1px dashed #3b5578;
          border-radius: 10px; color: #e6edf7; }
  button { margin-top: 14px; width: 100%; padding: 14px; font-size: 16px; font-weight: 700;
           background: #16a34a; color: #fff; border: 0; border-radius: 10px; cursor: pointer; }
  button[disabled] { opacity: .6; cursor: progress; }
  #out { margin-top: 18px; }
  #out img { width: 100%; border-radius: 10px; border: 1px solid #2c3f63; }
  .meta { font-size: 13px; color: #9fb3d1; margin-top: 8px; }
  .err { color: #fca5a5; }
</style>
<div class="card">
  <h1>Brand an image</h1>
  <input id="file" type="file" accept="image/jpeg,image/png,image/webp">
  <button id="go">Add shop details</button>
  <div id="out"></div>
</div>
<script>
  const file = document.getElementById('file');
  const go = document.getElementById('go');
  const out = document.getElementById('out');
  go.onclick = async () => {
    if (!file.files || !file.files[0]) { out.innerHTML = '<p class="err">Choose an image first.</p>'; return; }
    go.disabled = true; out.innerHTML = '<p class="meta">Rendering…</p>';
    try {
      const body = new FormData();
      body.append('image', file.files[0]);
      const r = await fetch('/api/branded/generate', { method: 'POST', body });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Failed');
      out.innerHTML = '<img src="' + j.imageUrl + '?t=' + Date.now() + '">' +
        '<p class="meta">' + j.width + '×' + j.height +
        ' &middot; from ' + j.source.width + '×' + j.source.height + ' ' + j.source.format +
        ' &middot; <a style="color:#7dd3fc" href="' + j.imageUrl + '" download>download</a></p>';
    } catch (e) {
      out.innerHTML = '<p class="err">' + e.message + '</p>';
    } finally {
      go.disabled = false;
    }
  };
</script>`);
});

export default router;
