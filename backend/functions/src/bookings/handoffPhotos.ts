import { LIMITS, storagePaths, type ImageRef } from '@loane/shared';
import { invalidArgument } from '../lib/errors';
import { isPlainObject } from '../lib/input';
import { isDownloadUrlFor, isSafePathUnder } from '../lib/downloadUrl';

const PHOTO_PROBLEM = 'One of your photos did not upload properly. Try adding it again.';
const MAX_PHOTO_SIDE = 20_000;

/**
 * Drop-off, return and problem photos on a rental.
 *
 * These are the whole record a damage complaint has — no money is held —
 * and an admin decides the complaint by looking at them. So each one has
 * to be a photo SHE uploaded to Loane for THIS rental (her folder,
 * `users/{uid}/bookings/{bookingId}/`), and its link has to be that very
 * file. Before, the phone's list was taken as it came: a "photo" could be
 * a link to any picture on the internet, or to the other girl's own
 * drop-off photo passed off as proof. Same idea as looks and pieces.
 */
export function checkHandoffPhotos(photos: unknown, uid: string, bookingId: string): ImageRef[] {
  if (photos == null) return [];
  if (!Array.isArray(photos)) throw invalidArgument('Those photos did not come through.');
  if (photos.length > LIMITS.bookingPhotos.max) {
    throw invalidArgument(`Up to ${LIMITS.bookingPhotos.max} photos.`);
  }
  const folder = storagePaths.bookingPhoto(uid, bookingId, '');
  return photos.map((value) => {
    if (!isPlainObject(value)) throw invalidArgument(PHOTO_PROBLEM);
    const { path, url, width, height } = value;
    if (!isSafePathUnder(path, folder)) throw invalidArgument(PHOTO_PROBLEM);
    if (typeof url !== 'string' || url.length > 2048 || !isDownloadUrlFor(url, path)) {
      throw invalidArgument(PHOTO_PROBLEM);
    }
    for (const side of [width, height]) {
      if (
        typeof side !== 'number' ||
        !Number.isFinite(side) ||
        side <= 0 ||
        side > MAX_PHOTO_SIDE
      ) {
        throw invalidArgument(PHOTO_PROBLEM);
      }
    }
    return { path, url, width: width as number, height: height as number };
  });
}
