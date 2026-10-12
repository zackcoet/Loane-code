import { describe, expect, it } from 'vitest';
import { isSharedKey, tryOnCacheKey, type CacheBody } from '../tryon/cacheKey';

/**
 * The cache key is the cost model. A generation is $0.075, so these
 * tests are about money as much as correctness.
 *
 * Two properties matter more than the rest and are easy to break by
 * "simplifying" the key later:
 *
 *   - replacing a flat photo must MISS, or students are shown try-ons
 *     of a photo that no longer exists
 *   - a preset key must contain NO uid, or the shared campus-wide cache
 *     silently becomes per-user and the bill multiplies by the number
 *     of students
 */

const PRESET: CacheBody = { kind: 'preset', presetId: 'female' };
const MINE: CacheBody = {
  kind: 'own',
  bodyPhotoPath: 'users/uid-ella/tryon/body/me.jpg',
  uploadedAt: '2026-10-12T00:00:00Z',
};

const dress = { listingId: 'listing-1', flatPhotoStamp: 'photo-a' };
const top = { listingId: 'listing-2', flatPhotoStamp: 'photo-b' };

describe('tryOnCacheKey', () => {
  it('is stable: the same body and pieces give the same key', () => {
    expect(tryOnCacheKey(PRESET, [dress])).toBe(tryOnCacheKey(PRESET, [dress]));
  });

  it('MISSES when the flat photo is replaced', () => {
    // The lender swapped her photo. Every cached result for that
    // garment has to miss, or we keep serving an image of a photo that
    // no longer exists.
    const replaced = { listingId: 'listing-1', flatPhotoStamp: 'photo-a-v2' };
    expect(tryOnCacheKey(PRESET, [replaced])).not.toBe(tryOnCacheKey(PRESET, [dress]));
  });

  it('differs per preset body', () => {
    const male: CacheBody = { kind: 'preset', presetId: 'male' };
    expect(tryOnCacheKey(male, [dress])).not.toBe(tryOnCacheKey(PRESET, [dress]));
  });

  it('differs per garment', () => {
    expect(tryOnCacheKey(PRESET, [top])).not.toBe(tryOnCacheKey(PRESET, [dress]));
  });

  it('treats order as part of the result, because it is', () => {
    // Phase 0: whatever goes on second is where quality is lost, so
    // top-then-dress is genuinely a different image from dress-then-top.
    expect(tryOnCacheKey(PRESET, [top, dress])).not.toBe(tryOnCacheKey(PRESET, [dress, top]));
  });

  it('gives every student the SAME key for a preset body', () => {
    // This is what makes one dress on Preset B cost $0.075 for the
    // whole campus instead of $0.075 each. The key takes no uid at all,
    // so there is no way for a caller to accidentally scope it.
    const key = tryOnCacheKey(PRESET, [dress]);
    expect(JSON.stringify(PRESET)).not.toContain('uid');
    expect(tryOnCacheKey({ kind: 'preset', presetId: 'female' }, [dress])).toBe(key);
  });

  it("never collides with somebody else's own-photo key", () => {
    const hers: CacheBody = {
      kind: 'own',
      bodyPhotoPath: 'users/uid-maddie/tryon/body/me.jpg',
      uploadedAt: '2026-10-12T00:00:00Z',
    };
    expect(tryOnCacheKey(hers, [dress])).not.toBe(tryOnCacheKey(MINE, [dress]));
  });

  it('MISSES when she retakes her body photo', () => {
    const retaken: CacheBody = { ...MINE, uploadedAt: '2026-10-13T00:00:00Z' };
    expect(tryOnCacheKey(retaken, [dress])).not.toBe(tryOnCacheKey(MINE, [dress]));
  });

  it('is a 64-character hex digest, usable as a document field', () => {
    expect(tryOnCacheKey(PRESET, [dress])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('isSharedKey', () => {
  it('says preset results may be served to anybody', () => {
    expect(isSharedKey(PRESET)).toBe(true);
  });

  it('says her own body results may not', () => {
    expect(isSharedKey(MINE)).toBe(false);
  });
});
