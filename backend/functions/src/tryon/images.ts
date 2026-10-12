/**
 * Getting images in and out of Storage for try-on.
 *
 * Everything travels as base64 through a Cloud Function. Nothing here
 * ever produces a public URL for a body photo or a result — those two
 * paths are owner-read only, which is a new shape in this repo and must
 * not be copied from the rules above them.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from 'firebase-functions';
import { getStorage } from 'firebase-admin/storage';
import type { ImageRef, PresetId } from '@loane/shared';
import { internal } from '../lib/errors';

/**
 * The bucket, named explicitly.
 *
 * NOT the ambient default. The app uploads to the bucket in its own
 * .env — `demo-loane.firebasestorage.app` — and a function resolving
 * some other default reads an empty bucket and fails with "could not
 * read that photo", which tells nobody anything. Firebase projects
 * created after late 2024 use .firebasestorage.app while the SDK's
 * historical default is .appspot.com, so the two genuinely differ.
 */
function bucketName(): string | undefined {
  if (process.env.STORAGE_BUCKET) return process.env.STORAGE_BUCKET;
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
  return projectId ? `${projectId}.firebasestorage.app` : undefined;
}

function bucket() {
  return getStorage().bucket(bucketName());
}

/**
 * Reads any Storage object as a data URI.
 *
 * Used for her body photo and for a listing's flat photo. Both are read
 * with admin credentials, which bypass the rules — the rules are what
 * stop the APP reading them.
 */
export async function bodyPhotoDataUri(path: string): Promise<string> {
  try {
    const [buffer] = await bucket().file(path).download();
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (error) {
    // Vague to her, specific in the log — a bucket or path mistake is
    // a deploy problem and the log is the only place to debug it.
    logger.error('Try-on could not read a photo', {
      path,
      bucket: bucketName(),
      error: (error as Error)?.message,
    });
    throw internal('Could not read that photo.');
  }
}

/**
 * A garment's flat photo.
 *
 * Normally a Storage path. The SEED stores its photos inline as data
 * URIs instead — an emulator download URL embeds 127.0.0.1, which a
 * phone cannot reach — so a seeded listing has no Storage object to
 * download. Handling both here is what lets try-on be tested locally at
 * all.
 *
 * This is only ever a GARMENT photo. Body photos take the Storage path
 * above and nothing else, because a body photo must never arrive from
 * something the app wrote.
 */
export async function garmentDataUri(ref: ImageRef): Promise<string> {
  if (ref.url?.startsWith('data:')) return ref.url;
  return bodyPhotoDataUri(ref.path);
}

/**
 * A preset body, read from the bundled brand assets.
 *
 * These are three files that never change, so they live in the repo and
 * ship with the functions rather than costing a Storage round trip on
 * every generation. They are brand assets, not user content.
 */
export async function presetImageDataUri(presetId: PresetId): Promise<string> {
  try {
    /*
      __dirname is backend/functions/lib at runtime (esbuild emits one
      CJS bundle there), so ONE level up is backend/functions. Two was
      backend/, which silently found nothing and reported "that body is
      not available yet" for every preset.

      The folder is deployed because firebase.json's functions `ignore`
      list does not exclude it.
    */
    const file = join(__dirname, '..', 'assets', 'tryon-presets', `${presetId}.jpg`);
    const buffer = await readFile(file);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {
    // A missing preset file is a deploy mistake, not her mistake.
    logger.error('Preset image missing', { presetId });
    throw internal('That model is not available right now.');
  }
}

/**
 * Writes a generated result and returns its Storage PATH, not a URL.
 *
 * The app reads it through the owner-read rule with its own credentials.
 * Minting a public URL here would make the image readable by anybody who
 * ever saw the link, which for a photograph of her body is the one
 * mistake this feature cannot make.
 */
export async function storeResult(uid: string, tryOnId: string, base64: string): Promise<string> {
  const path = `users/${uid}/tryon/results/${tryOnId}.jpg`;
  await bucket()
    .file(path)
    .save(Buffer.from(base64, 'base64'), {
      contentType: 'image/jpeg',
      // No public URL token. See above.
      metadata: { cacheControl: 'private, max-age=0' },
    });
  return path;
}

/** Deletes everything under one of her try-on folders. */
export async function deleteTryOnFolder(uid: string, kind: 'body' | 'results'): Promise<void> {
  await bucket().deleteFiles({ prefix: `users/${uid}/tryon/${kind}/`, force: true });
}
