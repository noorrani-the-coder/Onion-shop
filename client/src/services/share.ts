import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Sharing the poster as an actual image.
 *
 * Two things have to be right for WhatsApp to attach the PNG instead of a link:
 *
 *  - The share payload must carry the *file*, not a URL. `navigator.share({ url })`
 *    hands the receiving app a link, which WhatsApp renders as a text preview (and
 *    a link to our server is useless to the recipient anyway).
 *  - On Android the app runs inside a Capacitor WebView, which does not implement
 *    the Web Share API at all — `navigator.share` is undefined there. Native builds
 *    have to go through the Share plugin, writing the bytes to the cache directory
 *    first so there is a file:// URI to hand over.
 *
 * Web browsers that support file sharing use the Web Share API; everything else
 * falls back to downloading the image and copying the caption.
 */

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

export interface SharePosterOptions {
  /** Absolute URL of the poster PNG (already passed through apiUrl). */
  imageUrl: string;
  /** File name the recipient sees. */
  fileName: string;
  /** Share sheet title / email subject. */
  title: string;
  /** Caption sent alongside the image. */
  text: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the "data:image/png;base64," prefix — the plugin wants raw base64.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function isCancellation(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  if (!e) return false;
  if (e.name === 'AbortError') return true;
  // The Capacitor Share plugin reports a dismissed sheet as a plain error.
  return /cancel/i.test(e.message || '');
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the click a tick to start before revoking.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

export async function sharePosterImage(opts: SharePosterOptions): Promise<ShareOutcome> {
  const { imageUrl, fileName, title, text } = opts;

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Could not load poster (${response.status})`);
  const blob = await response.blob();

  if (Capacitor.isNativePlatform()) {
    try {
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: await blobToBase64(blob),
        directory: Directory.Cache
      });
      await Share.share({ title, text, files: [uri], dialogTitle: 'Share market report' });
      return 'shared';
    } catch (err) {
      if (isCancellation(err)) return 'cancelled';
      throw err;
    }
  }

  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, text, files: [file] });
      return 'shared';
    } catch (err) {
      if (isCancellation(err)) return 'cancelled';
      // Fall through to the download fallback below.
    }
  }

  downloadBlob(blob, fileName);
  await navigator.clipboard?.writeText(text).catch(() => {});
  return 'downloaded';
}

/** The caption that travels with the poster. */
export function posterCaption(params: {
  shopName?: string | null;
  dateDisplay: string;
  market?: string | null;
  bigRate?: string | null;
  arrivals?: string | null;
}): string {
  const lines = [
    `🧅 *${params.shopName || 'APMC ONION'} MARKET REPORT*`,
    `📅 Date: ${params.dateDisplay}`,
    `🏢 Market: ${params.market || 'APMC Bengaluru'}`
  ];
  if (params.bigRate) lines.push(`💰 Big Onion Rate: ₹${params.bigRate} / 100kg`);
  if (params.arrivals) lines.push(`📦 Arrivals: ${params.arrivals}`);
  return lines.join('\n');
}

export interface SaveResult {
  outcome: ShareOutcome;
  /** Where the file landed, when it was written to the device. */
  location?: string;
}

/**
 * Saves an image to the device.
 *
 * On the web a plain `<a download>` stopped working once images moved to
 * Supabase Storage — the attribute is ignored for cross-origin URLs, so the
 * browser navigated to the picture instead of saving it. Fetching the bytes
 * first sidesteps that: the object URL that results is same-origin, so
 * `download` is honoured again.
 *
 * On Android this writes into the public Documents folder rather than opening
 * the share sheet. Sharing and saving are different intentions — a trader who
 * taps Download wants the file kept, not a list of apps to send it to — and
 * Share is its own button for the other case. If the platform refuses the
 * write, the share sheet is offered rather than failing outright, since that
 * still gets the file somewhere useful.
 */
export async function saveImage(imageUrl: string, fileName: string): Promise<SaveResult> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Could not load the image (${response.status})`);
  const blob = await response.blob();

  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, fileName);
    return { outcome: 'downloaded' };
  }

  const data = await blobToBase64(blob);

  try {
    // Documents needs permission on Android; ask only if it is not already given.
    const status = await Filesystem.checkPermissions().catch(() => null);
    if (status && status.publicStorage !== 'granted') {
      await Filesystem.requestPermissions().catch(() => null);
    }

    await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Documents,
      recursive: true
    });
    return { outcome: 'downloaded', location: `Documents/${fileName}` };
  } catch (err) {
    // Scoped storage refused the write. Hand it to the share sheet instead of
    // leaving the user with nothing.
    try {
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data,
        directory: Directory.Cache
      });
      await Share.share({ files: [uri], dialogTitle: 'Save image' });
      return { outcome: 'shared' };
    } catch (shareErr) {
      if (isCancellation(shareErr)) return { outcome: 'cancelled' };
      throw shareErr;
    }
  }
}
