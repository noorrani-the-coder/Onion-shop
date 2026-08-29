import { Router, Request, Response } from 'express';
import { parseArrivalsMessage } from '../services/parser/arrivalsParser';
import { ArrivalsBoardGenerator } from '../services/image/arrivalsBoard/renderer';
import { publishImage } from '../services/storage/imageStore';
import { db } from '../database/db';
import { ArrivalsBoardData } from '../../../shared/types';
import { ExtractRequestSchema, GenerateArrivalsBoardSchema } from '../../../shared/schemas';

const router = Router();

/**
 * POST /api/arrivals/parse
 *
 * Raw forwarded message in, structured board data out. Split from /generate so
 * the operator can see what was understood — and fix it — before an image goes
 * out to a WhatsApp group with the wrong bag count on it.
 */
router.post('/parse', (req: Request, res: Response): void => {
  const parsed = ExtractRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.format() });
    return;
  }

  const result = parseArrivalsMessage(parsed.data.message);
  res.json({
    success: true,
    data: result.data,
    warnings: result.warnings,
    unparsedLines: result.unparsedLines
  });
});

/**
 * POST /api/arrivals/generate
 *
 * Renders the board. Accepts either a raw message (parsed here) or structured
 * data the caller has already reviewed.
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const parsed = GenerateArrivalsBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.format() });
    return;
  }

  try {
    let data: ArrivalsBoardData;
    let warnings: string[] = [];

    if (parsed.data.rawMessage) {
      const result = parseArrivalsMessage(parsed.data.rawMessage);
      data = result.data;
      warnings = result.warnings;
      if (data.markets.length === 0) {
        res.status(422).json({
          success: false,
          error: 'No arrival rows could be read from that message.',
          warnings
        });
        return;
      }
    } else {
      data = parsed.data.data as ArrivalsBoardData;
    }

    // A board of empty markets is a caller mistake, not a server fault: the
    // generator would throw, and a 500 would send whoever posted this looking
    // for a bug on our side instead of at their payload.
    if (data.markets.every(market => market.products.length === 0)) {
      res.status(422).json({
        success: false,
        error: 'Every market is empty — an arrivals board needs at least one product row.',
        warnings
      });
      return;
    }

    const settings = await db.getSettings();
    const board = await ArrivalsBoardGenerator.generate(data, settings);
    const publishedUrl = await publishImage(board.fileName);

    res.json({
      success: true,
      imageUrl: publishedUrl,
      imagePath: board.absolutePath,
      // The canvas is data-driven, so callers must not assume a fixed size.
      width: board.width,
      height: board.height,
      data,
      warnings
    });
  } catch (err: any) {
    console.error('Error generating arrivals board:', err);
    res.status(500).json({ success: false, error: err.message || 'Board generation failed' });
  }
});

export default router;
