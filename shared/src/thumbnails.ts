/**
 * Thumbnails — the small copy of a listing or post photo that grids load.
 *
 * The app uploads one photo at up to 1600px. A Discover or profile grid
 * cell is about a third of the screen, so loading the full photo there
 * downloads roughly ten times the pixels anyone sees. A Cloud Function
 * (`makeThumbnail`) writes a small WebP beside every listing and post
 * photo; grids ask for that and fall back to the full photo if it is
 * not there yet (the first second after upload) or never will be
 * (photos uploaded before thumbnails existed).
 *
 * WHY THE THUMBNAIL IS FOUND BY ITS NAME, NOT STORED ON THE DOCUMENT.
 * The photo is uploaded before the listing or post exists, so the
 * function cannot reliably write the thumbnail's URL onto a document
 * that may not be there yet — and a later edit from the app would
 * overwrite it anyway. A fixed naming rule needs no document at all:
 * both sides compute the same path from the photo's path.
 *
 * Only listing and post photos get thumbnails. They are the ones in
 * grids, and they are the only folders anyone may read without signing
 * in (see backend/storage.rules), which is what lets the URL below work
 * without a download token.
 */

/** Long edge of a thumbnail, in pixels. A third of a 430pt phone at 3x. */
export const THUMBNAIL_MAX_EDGE = 480;

/** The folder each thumbnail sits in, beside its photo. */
export const THUMBNAIL_FOLDER = 'thumbs';

/** WebP keeps the transparency of a cutout flat photo, and is small. */
export const THUMBNAIL_CONTENT_TYPE = 'image/webp';

const THUMBNAIL_SOURCE = /^users\/[^/]+\/(listings|posts)\/[^/]+\/[^/]+$/;

/**
 * True for a listing or post photo that should get a thumbnail. False
 * for every other folder, and for thumbnails themselves — which is what
 * stops the function triggering itself forever.
 */
export function wantsThumbnail(path: string): boolean {
  return THUMBNAIL_SOURCE.test(path);
}

/**
 * Where the thumbnail of a photo lives.
 * `users/u/listings/l/1.jpg` → `users/u/listings/l/thumbs/1.webp`.
 * Null for a photo that never gets one.
 */
export function thumbnailPathFor(path: string): string | null {
  if (!wantsThumbnail(path)) return null;
  const slash = path.lastIndexOf('/');
  const folder = path.slice(0, slash);
  const file = path.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  const stem = dot > 0 ? file.slice(0, dot) : file;
  return `${folder}/${THUMBNAIL_FOLDER}/${stem}.webp`;
}

/**
 * The thumbnail URL for a photo's download URL, or null if it has none.
 *
 * Works on the photo's URL rather than its path because most screens
 * only have the URL (a booking keeps a copy of the cover URL, not its
 * path). Firebase download URLs carry the encoded path after `/o/`, on
 * both the real service and the emulator, so the thumbnail's URL is the
 * same address with the path swapped. The download token is dropped: it
 * belongs to the full photo, and these folders are publicly readable.
 */
export function thumbnailUrlFor(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = url.indexOf('/o/');
  if (marker < 0) return null;
  const start = marker + 3;
  const end = url.indexOf('?', start);
  const encoded = end < 0 ? url.slice(start) : url.slice(start, end);
  let path: string;
  try {
    path = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  const thumb = thumbnailPathFor(path);
  if (!thumb) return null;
  return `${url.slice(0, start)}${encodeURIComponent(thumb)}?alt=media`;
}
