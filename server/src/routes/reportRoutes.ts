import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { aiExtractor } from '../services/ai/aiExtractor';
import { ImageTranscriber } from '../services/ai/imageTranscriber';
import { parseArrivalsMessage } from '../services/parser/arrivalsParser';
import { PosterGenerator } from '../services/image/posterGenerator';
import { db } from '../database/db';
import { publishImage } from '../services/storage/imageStore';
import { ExtractRequestSchema, GeneratePosterRequestSchema } from '../../../shared/schemas';

const router = Router();

const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_IMAGES.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type ${file.mimetype}. Send a JPEG, PNG or WebP.`));
      return;
    }
    cb(null, true);
  },
});

/** Multer's refusals are the caller's mistake, so they get 4xx JSON, not a 500 page. */
const acceptImage = (req: Request, res: Response, next: NextFunction): void => {
  uploadImage.single('image')(req, res, (err: unknown) => {
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
  });
};

/**
 * POST /api/reports/extract-image
 *
 * Reads a photographed or forwarded report and returns the same extraction the
 * paste flow produces, so the image path rejoins the existing verify screen
 * rather than growing a second one.
 *
 * The transcript comes back as `rawMessage`: it is what the figures were read
 * from, and the operator confirming the numbers should be able to see it. No
 * poster is produced here — nothing reaches a customer without a human
 * checking the rates first, which matters more for a photo than for pasted
 * text, because a smudged 3 can be read as an 8.
 */
router.post('/extract-image', acceptImage, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file?.buffer?.length) {
      res.status(400).json({ success: false, error: 'No image was uploaded (field name must be "image").' });
      return;
    }
    if (!ImageTranscriber.isConfigured) {
      res.status(503).json({ success: false, error: 'Image reading is not configured on this server.' });
      return;
    }

    const transcript = await ImageTranscriber.transcribe(req.file.buffer);

    /**
     * Two different reports arrive as pictures, and they are not the same data.
     *
     * A rate report lists grades against price ranges; an arrivals board lists
     * products against bag counts and vehicle counts. Reading the second with
     * the rate extractor is not a near miss — "26,776 BAGS" comes back as a
     * rate of 776, the second market disappears and every vehicle count is
     * lost. So the transcript decides which pipeline it belongs to before
     * anything tries to structure it.
     */
    const arrivals = parseArrivalsMessage(transcript.text);
    const looksLikeArrivals = arrivals.data.markets.some(m => m.products.length > 0);

    if (looksLikeArrivals) {
      res.json({
        success: true,
        kind: 'arrivals',
        arrivals: arrivals.data,
        warnings: arrivals.warnings,
        rawMessage: transcript.text,
        transcribedFrom: transcript.source,
      });
      return;
    }

    const extraction = await aiExtractor.extractMarketReport(transcript.text);
    res.json({
      ...extraction,
      kind: 'rates',
      rawMessage: transcript.text,
      transcribedFrom: transcript.source,
    });
  } catch (err: any) {
    console.error('Image extraction failed:', err);
    res.status(422).json({
      success: false,
      error: err.message || 'Could not read a report from that image.',
    });
  }
});

// POST /api/reports/extract
router.post('/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = ExtractRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: parseResult.error.format()
      });
      return;
    }

    const { message } = parseResult.data;
    const extraction = await aiExtractor.extractMarketReport(message);

    res.json(extraction);
  } catch (err: any) {
    console.error('Error during report extraction:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal extraction failure'
    });
  }
});

// POST /api/reports/generate
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = GeneratePosterRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid report data for poster generation',
        details: parseResult.error.format()
      });
      return;
    }

    const { reportId, rawMessage, extractedData, data, settings: customSettings } = parseResult.data;

    // Load active shop settings merged with any custom override
    const currentSettings = await db.getSettings();
    const effectiveSettings = {
      ...currentSettings,
      ...(customSettings || {})
    };

    // Render deterministic PNG
    const { fileName, absolutePath, urlPath } = await PosterGenerator.generatePoster(data, effectiveSettings);
    // Stored against the record so it survives the next deploy wiping the disk.
    const publishedUrl = await publishImage(fileName);

    // Save/update report in DB
    const record = await db.createOrUpdateReport({
      id: reportId,
      rawMessage: rawMessage || '',
      extractedData: extractedData || data,
      editedData: data,
      imagePath: publishedUrl,
      reportDate: data.reportDate || undefined
    });

    res.json({
      success: true,
      reportId: record.id,
      imageUrl: publishedUrl,
      imagePath: absolutePath,
      reportDate: record.reportDate,
      createdAt: record.createdAt,
      record
    });
  } catch (err: any) {
    console.error('Error generating poster:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Poster generation failed'
    });
  }
});

// GET /api/reports
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const reports = await db.getAllReports();
    res.json({ success: true, reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const report = await db.getReportById(id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await db.deleteReport(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }
    res.json({ success: true, message: 'Report deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
