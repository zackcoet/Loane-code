import type { Category } from '../constants';
import type { BaseDoc, Timestampish } from './common';

/** Which preset body. Labelled by build only — never a name, never a number. */
export type PresetId = 'petite' | 'medium' | 'curve';

/**
 * `tryOns/{tryOnId}` — one generated image.
 *
 * PRIVATE TO ITS OWNER, ALWAYS. Never in a feed, never on a profile,
 * never in search, never visible to an admin. Nothing in here is
 * denormalized into any document another student can read — no
 * counters, no previews, no "3 friends tried this on".
 *
 * Written only by Cloud Functions. The app cannot write one field.
 */
export interface TryOn extends BaseDoc {
  uid: string;

  /** Which body. 'own' means her own photo. */
  bodyKind: 'own' | 'preset';
  /** Set when bodyKind is 'preset', else null. */
  presetId: PresetId | null;

  /**
   * The pieces, in the order they were applied. One today; two when
   * layering arrives. Order matters — it is how the result was built,
   * and Phase 0 showed whatever goes on second is where quality is lost.
   */
  pieces: TryOnPiece[];

  /** Storage path. NOT a public URL — these are owner-read only. */
  imagePath: string;

  /**
   * Same body + same pieces in the same order = same key, so an
   * identical result is never paid for twice. See cacheKey.ts for why
   * the flat photo's timestamp is part of it.
   */
  cacheKey: string;

  /** True once she taps Save look. Unsaved try-ons are swept after 7 days. */
  saved: boolean;
}

export interface TryOnPiece {
  listingId: string;
  /** Denormalized so a saved look renders without reading every listing. */
  name: string;
  coverUrl: string | null;
  ownerUid: string;
  category: Category;
}

/**
 * Her try-on state, on `users/{uid}/private/settings`.
 *
 * NOT on the public user document. A body photo must never be
 * denormalized into anything another student can read, and neither
 * must how much she has used the feature.
 *
 * Written only by Cloud Functions — `profileChecklist` and `phone` are
 * app-writable on this document, this block is not. The security
 * rules' `onlyChanges` allowlist is what enforces that.
 */
export interface UserTryOn {
  /** Storage path of her body photo, or null. */
  bodyPhotoPath: string | null;
  bodyPhotoUploadedAt: Timestampish | null;
  /** She ticked "This is a photo of me". Recorded, with when. */
  selfConfirmedAt: Timestampish | null;

  /**
   * Lifetime count of generations that actually cost money.
   *
   * CACHE HITS DO NOT COUNT. A cached result costs us nothing, so
   * charging an allowance for it would be charging her for our saving
   * — and it would make the shared preset cache feel like a penalty
   * rather than the thing that makes presets worth having.
   */
  generationsUsed: number;

  /**
   * Extra free try-ons granted by an admin, on top of the free
   * allowance. This is how Ella and testers are not blocked at five.
   */
  bonusGranted: number;
}

/**
 * `config/tryOn` — the on/off switch.
 *
 * Readable by any signed-in student so the app can hide the feature
 * without a deploy. Written only by an admin, through a function.
 */
export interface TryOnConfig {
  /** Master switch. Off means the entry points are absent everywhere. */
  enabled: boolean;
  /**
   * On for admins even when `enabled` is false, so we can test the
   * feature in production before switching it on for a campus.
   */
  enabledForAdmins: boolean;
  updatedAt: Timestampish;
  updatedBy: string | null;
}
