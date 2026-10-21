/**
 * The image work behind `makeThumbnail`, kept apart from the trigger so
 * it can be tested without a Storage bucket.
 */

import sharp from 'sharp';
import { THUMBNAIL_MAX_EDGE } from '@loane/shared';

/**
 * Resizes to fit a THUMBNAIL_MAX_EDGE square, never enlarging, and
 * re-encodes as WebP. `rotate()` with no argument applies the phone's
 * EXIF orientation first, so a portrait photo does not come out
 * sideways; the output carries no EXIF, which also drops any location
 * the camera wrote.
 */
export async function renderThumbnail(source: Buffer): Promise<Buffer> {
  return sharp(source)
    .rotate()
    .resize({
      width: THUMBNAIL_MAX_EDGE,
      height: THUMBNAIL_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();
}
