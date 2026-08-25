import { Router, Request, Response } from 'express';
import { aiExtractor } from '../services/ai/aiExtractor';
import { PosterGenerator } from '../services/image/posterGenerator';
import { db } from '../database/db';
import { ExtractRequestSchema, GeneratePosterRequestSchema } from '../../../shared/schemas';

const router = Router();

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

    // Save/update report in DB
    const record = await db.createOrUpdateReport({
      id: reportId,
      rawMessage: rawMessage || '',
      extractedData: extractedData || data,
      editedData: data,
      imagePath: urlPath,
      reportDate: data.reportDate || undefined
    });

    res.json({
      success: true,
      reportId: record.id,
      imageUrl: urlPath,
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
