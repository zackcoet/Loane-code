/**
 * The thumbnail renderer. Runs without the emulators: it is pure image
 * work, so it checks the one thing that matters — what comes out.
 */

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { THUMBNAIL_MAX_EDGE } from '@loane/shared';
import { renderThumbnail } from '../storage/renderThumbnail';

function photo(width: number, height: number, alpha = false) {
  return sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha ? { r: 200, g: 30, b: 60, alpha: 0 } : { r: 200, g: 30, b: 60 },
    },
  })
    [alpha ? 'png' : 'jpeg']()
    .toBuffer();
}

describe('renderThumbnail', () => {
  it('shrinks a portrait phone photo so its long edge fits', async () => {
    const out = await sharp(await renderThumbnail(await photo(1200, 1600))).metadata();
    expect(out.format).toBe('webp');
    expect(out.height).toBe(THUMBNAIL_MAX_EDGE);
    expect(out.width).toBe(360);
  });

  it('shrinks a landscape photo by its width', async () => {
    const out = await sharp(await renderThumbnail(await photo(1600, 800))).metadata();
    expect(out.width).toBe(THUMBNAIL_MAX_EDGE);
    expect(out.height).toBe(240);
  });

  it('never enlarges a photo that is already small', async () => {
    const out = await sharp(await renderThumbnail(await photo(300, 200))).metadata();
    expect(out.width).toBe(300);
    expect(out.height).toBe(200);
  });

  it('keeps the transparency of a cutout', async () => {
    const out = await sharp(await renderThumbnail(await photo(1000, 1000, true))).metadata();
    expect(out.hasAlpha).toBe(true);
  });

  it('is much smaller than the photo it came from', async () => {
    // Noise compresses badly, so this is a fair stand-in for a real photo.
    const noise = Buffer.alloc(1600 * 1200 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) % 251;
    const source = await sharp(noise, { raw: { width: 1600, height: 1200, channels: 3 } })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumb = await renderThumbnail(source);
    expect(thumb.length).toBeLessThan(source.length / 4);
  });

  it('rejects a file that is not an image', async () => {
    await expect(renderThumbnail(Buffer.from('not a photo'))).rejects.toThrow();
  });
});
