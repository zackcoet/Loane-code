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
import { getStorage } from 'firebase-admin/storage';
import type { ImageRef, PresetId } from '@loane/shared';
import { internal } from '../lib/errors';

function bucket() {
  return getStorage().bucket();
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
  } catch {
    // Deliberately vague to her, specific in the log via the caller.
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
    const file = join(__dirname, '..', '..', 'assets', 'tryon-presets', `${presetId}.jpg`);
    const buffer = await readFile(file);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {
    // Until Zack and Ella sign the presets off, these files do not
    // exist — so this says so plainly rather than looking like a bug.
    throw internal('That body is not available yet.');
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
