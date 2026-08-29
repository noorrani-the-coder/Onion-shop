import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '../../database/supabase';
import { PUBLIC_DIR } from '../../paths';

/**
 * Where generated images live.
 *
 * The host's filesystem is not storage: every deploy replaces the container and
 * takes `public/posters` with it, so a poster generated this morning 404s this
 * afternoon while its row still sits in the database pointing at it. History
 * then shows broken thumbnails for work the shop actually did.
 *
 * So images go to a Supabase bucket, which outlives deploys, and the public URL
 * is what gets stored. The local copy is still written first — it is what the
 * renderer produces, it makes local development work with no credentials, and
 * it is the fallback if the upload fails. Only the URL handed back changes.
 */

const BUCKET = 'posters';
const POSTERS_DIR = path.join(PUBLIC_DIR, 'posters');

function contentTypeFor(fileName: string): string {
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  if (fileName.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

/**
 * Publishes a rendered image and returns the path to store against the record.
 *
 * Returns the bucket's public URL when the upload succeeds, and the local
 * `/posters/...` path when Supabase is not configured or the upload fails —
 * a working image on this host beats an error, and the caller cannot tell the
 * difference because both are just a URL.
 */
export async function publishImage(fileName: string): Promise<string> {
  const localPath = `/posters/${fileName}`;
  const absolutePath = path.join(POSTERS_DIR, fileName);

  if (!supabase || !isSupabaseConfigured) return localPath;
  if (!fs.existsSync(absolutePath)) {
    console.warn(`publishImage: ${fileName} is not on disk; keeping the local path.`);
    return localPath;
  }

  try {
    const body = fs.readFileSync(absolutePath);
    const { error } = await supabase.storage.from(BUCKET).upload(fileName, body, {
      contentType: contentTypeFor(fileName),
      // Names carry a uuid, so a collision means a retry of the same render.
      upsert: true,
      cacheControl: '31536000',
    });

    if (error) {
      console.warn(`publishImage: upload failed for ${fileName}: ${error.message}`);
      return localPath;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    if (!data?.publicUrl) return localPath;

    return data.publicUrl;
  } catch (err) {
    console.warn(`publishImage: unexpected failure for ${fileName}:`, err);
    return localPath;
  }
}
