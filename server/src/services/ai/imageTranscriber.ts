import sharp from 'sharp';

/**
 * Reads the text off a photographed or forwarded market report.
 *
 * This deliberately stops at transcription. It could be asked for structured
 * JSON in one shot, but then a misread digit would arrive already dressed as a
 * rate, with nothing to check it against. Producing text first means the
 * existing parser does the structuring it is already tested for, and the
 * operator sees the transcript the numbers came from — so "4300" that should
 * have been "4800" is catchable rather than invisible.
 *
 * Nothing here is authoritative: the result goes to the verify screen for a
 * human to confirm before any poster is made from it.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'https://ollama.com';
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma4:31b';

/** Below this, even a good model is guessing at four-digit rates. */
const MIN_USEFUL_WIDTH = 500;

/**
 * Upper bound on what gets sent. Big enough for small print on a board,
 * small enough that a trader on mandi data is not uploading 8 megapixels.
 */
const MAX_WIDTH = 1600;

const PROMPT = [
  'This is a photograph or screenshot of an Indian agricultural market (APMC) report.',
  'Transcribe every line of text and every number exactly as printed, top to bottom.',
  '',
  'Rules:',
  '- Copy digits exactly, including commas and leading zeros (07 stays 07).',
  '- Keep rate ranges as written, e.g. 4300-4500.',
  '- Do not convert, total, correct or explain anything.',
  '- If a character is unreadable, write ? in its place rather than guessing.',
  '- Output plain text only: no markdown, no commentary, no JSON.',
].join('\n');

export interface TranscriptionResult {
  text: string;
  /** What was actually sent to the model, for the caller to report. */
  source: { width: number; height: number; sentWidth: number };
}

export class ImageTranscriber {
  public static get isConfigured(): boolean {
    return Boolean(process.env.OLLAMA_API_KEY);
  }

  /**
   * Returns the text visible in `imageBuffer`.
   *
   * Throws rather than returning an empty string: a silent blank would flow
   * into the parser and come back as a report with every field missing, which
   * looks like a bad photo instead of a failed call.
   */
  public static async transcribe(imageBuffer: Buffer): Promise<TranscriptionResult> {
    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey) throw new Error('Image reading is not configured on this server.');

    const meta = await sharp(imageBuffer).metadata();
    if (!meta.width || !meta.height) throw new Error('That file does not look like an image.');
    if (meta.width < MIN_USEFUL_WIDTH) {
      throw new Error(
        `That image is only ${meta.width}px wide — too small to read rates from reliably. Send a larger screenshot.`
      );
    }

    const sentWidth = Math.min(meta.width, MAX_WIDTH);
    const prepared = await sharp(imageBuffer)
      .rotate() // phone cameras record orientation rather than applying it
      .resize({ width: sentWidth, withoutEnlargement: true, kernel: 'lanczos3' })
      .jpeg({ quality: 90 })
      .toBuffer();

    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        stream: false,
        messages: [{ role: 'user', content: PROMPT, images: [prepared.toString('base64')] }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Could not read the image (${response.status}). ${await response.text()}`.slice(0, 300));
    }

    const result = (await response.json()) as { message?: { content?: string } };
    const text = (result.message?.content || '').trim();
    if (!text) throw new Error('The image reader returned nothing. Try a clearer photo.');

    return {
      text,
      source: { width: meta.width, height: meta.height, sentWidth },
    };
  }
}
