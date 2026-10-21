/**
 * `makeThumbnail` / `removeThumbnail`
 *
 * Writes a small WebP beside every listing and post photo, so grids
 * (Discover, profiles, closets, rentals) load a ~30 KB image instead of
 * the full 1600px photo. The naming rule, and why the thumbnail is found
 * by name rather than stored on the listing or post, is in
 * shared/src/thumbnails.ts.
 *
 * The app keeps compressing on the phone before upload — that is what
 * keeps the upload fast on campus Wi-Fi. This is the second size, made
 * where nobody can skip it.
 *
 * NOTHING HERE IS TRUSTED FROM THE PHONE. The source is re-read from
 * Storage and re-encoded; a file that is not really an image just fails
 * to decode, gets logged, and the grid keeps showing the full photo.
 */

import { onObjectDeleted, onObjectFinalized } from 'firebase-functions/v2/storage';
import { logger } from 'firebase-functions';
import { getStorage } from 'firebase-admin/storage';
import { THUMBNAIL_CONTENT_TYPE, thumbnailPathFor, wantsThumbnail } from '@loane/shared';
import { db } from '../lib/admin';
import { renderThumbnail } from './renderThumbnail';

function bucket(name: string) {
  // Touch the shared app so the Admin SDK is initialised exactly once.
  db();
  return getStorage().bucket(name);
}

export const makeThumbnail = onObjectFinalized(
  { region: 'us-central1', memory: '512MiB' },
  async (event) => {
    const { name, bucket: bucketName, contentType } = event.data;
    // The guard on the path is also what stops this function firing on
    // its own output forever: thumbnails sit in a folder it ignores.
    if (!name || !wantsThumbnail(name)) return;
    if (!contentType?.startsWith('image/')) return;
    const target = thumbnailPathFor(name);
    if (!target) return;

    const files = bucket(bucketName);
    try {
      const [source] = await files.file(name).download();
      const thumb = await renderThumbnail(source);
      await files.file(target).save(thumb, {
        resumable: false,
        contentType: THUMBNAIL_CONTENT_TYPE,
        metadata: {
          // A thumbnail never changes under the same name — a new photo
          // gets a new file name — so phones may keep it for a year.
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: { thumbnailOf: name },
        },
      });
    } catch (error) {
      // Not rethrown: a retry would fail the same way on a bad file, and
      // the grid already falls back to the full photo.
      logger.error('makeThumbnail failed', {
        path: name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

/** Deleting a photo takes its thumbnail with it. */
export const removeThumbnail = onObjectDeleted({ region: 'us-central1' }, async (event) => {
  const { name, bucket: bucketName } = event.data;
  if (!name || !wantsThumbnail(name)) return;
  const target = thumbnailPathFor(name);
  if (!target) return;
  await bucket(bucketName).file(target).delete({ ignoreNotFound: true });
});
