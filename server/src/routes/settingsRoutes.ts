import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { ShopSettingsSchema } from '../../../shared/schemas';

const router = Router();

// GET /api/settings
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = ShopSettingsSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid shop settings data',
        details: parseResult.error.format()
      });
      return;
    }

    const updated = await db.updateSettings(parseResult.data);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
