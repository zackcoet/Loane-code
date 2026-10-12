/**
 * The cache key. This is the whole cost model.
 *
 * Same body plus the same pieces in the same order returns the stored
 * result and spends nothing. A generation is $0.075, so the hit rate
 * decides whether this feature can ever pay for itself.
 *
 * TWO THINGS HERE ARE EASY TO GET WRONG AND EXPENSIVE TO FIX LATER.
 *
 * 1. Each piece contributes its listing id AND the timestamp of that
 *    listing's flat photo. If a lender replaces her flat photo, every
 *    cached result for that garment must miss — otherwise students keep
 *    being shown a try-on of a photo that no longer exists. A cache
 *    that serves stale images is worse than no cache.
 *
 * 2. A PRESET BODY HASHES TO JUST THE PRESET ID, with no uid in it. So
 *    one dress on Preset B is generated once for the whole campus and
 *    served from cache forever after. That is the main argument for the
 *    presets existing beyond accessibility, and it is why the lookup
 *    deliberately does not filter by owner for preset bodies.
 *
 *    Her OWN photo hashes her body-photo path plus its upload time, so
 *    retaking her photo invalidates her whole cache, and her key can
 *    never collide with anybody else's.
 */

import { createHash } from 'node:crypto';
import type { PresetId } from '@loane/shared';

export interface CacheKeyPiece {
  listingId: string;
  /**
   * When that listing's flat photo was last set. Any stable stamp will
   * do as long as it CHANGES when the photo does.
   */
  flatPhotoStamp: string;
}

export type CacheBody =
  | { kind: 'preset'; presetId: PresetId }
  | { kind: 'own'; bodyPhotoPath: string; uploadedAt: string };

export function tryOnCacheKey(body: CacheBody, pieces: CacheKeyPiece[]): string {
  const bodyPart =
    body.kind === 'preset'
      ? `preset:${body.presetId}`
      : `own:${body.bodyPhotoPath}:${body.uploadedAt}`;

  // Order is part of the key, not incidental to it: Phase 0 showed the
  // garment applied second is where quality is lost, so a top-then-dress
  // result is genuinely a different image from dress-then-top.
  const piecePart = pieces.map((p) => `${p.listingId}@${p.flatPhotoStamp}`).join('|');

  return createHash('sha256').update(`${bodyPart}::${piecePart}`).digest('hex');
}

/** True when this key can be served to anybody, not just the person who paid. */
export function isSharedKey(body: CacheBody): boolean {
  return body.kind === 'preset';
}
