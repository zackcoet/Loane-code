/**
 * Discover's "For you" order for pieces — NORTH_STAR D5.
 *
 * The same five parts as a look's score (feedRanking.ts), read off a
 * listing instead of a post, with their own weights in
 * `FEED_RANKING.discover`:
 *
 *   who        she follows the owner / they follow each other / she has
 *              liked the owner's looks — the same `whoPart`
 *   what       the piece's occasions match the ones she saves pieces for
 *   fresh      newer pieces first, halving every week
 *   quality    saves, tags in looks and finished rentals per view —
 *              all counters only Cloud Functions write
 *   available  1 if she can rent or buy it this week, else 0
 *
 * Safe on her phone for the same reason as the feed: the parts about her
 * only reorder her own grid, and the parts about the piece come from
 * fields the security rules lock.
 */

import type { Occasion } from './constants';
import {
  FEED_RANKING,
  isListingAvailableSoon,
  whatPart,
  whoPart,
  type RankingViewer,
} from './feedRanking';
import type { IsoDate } from './types/common';
import type { Listing } from './types/listing';

export interface ListingScore {
  listingId: string;
  score: number;
  parts: { who: number; what: number; fresh: number; quality: number; available: number };
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Saves, tags and finished rentals per view, smoothed like a look's. */
export function listingQualityPart(stats: Listing['stats']): number {
  const cfg = FEED_RANKING.discover.quality;
  const w = cfg.actionWeights;
  const engagement =
    (stats.saveCount ?? 0) * w.save +
    (stats.tagCount ?? 0) * w.tag +
    (stats.completedRentals ?? 0) * w.rental;
  const reach = Math.max(0, stats.viewCount ?? 0);
  const rate = (engagement + cfg.priorRate * cfg.priorReach) / (reach + cfg.priorReach);
  return clamp01(rate / cfg.fullRate);
}

export function explainListingScore(
  listing: Pick<
    Listing,
    | 'id'
    | 'ownerUid'
    | 'occasions'
    | 'stats'
    | 'status'
    | 'intent'
    | 'salePriceCents'
    | 'bookedDates'
    | 'blackoutDates'
  >,
  createdAtMs: number | null,
  viewer: RankingViewer,
  nowMs: number,
  today: IsoDate,
): ListingScore {
  const hours = createdAtMs === null ? Infinity : Math.max(0, nowMs - createdAtMs) / 3_600_000;
  const parts = {
    who: whoPart(listing.ownerUid, viewer),
    what: whatPart(listing.occasions ?? [], viewer),
    fresh: clamp01(Math.pow(0.5, hours / FEED_RANKING.discover.freshHalfLifeHours)),
    quality: listingQualityPart(listing.stats),
    available: isListingAvailableSoon(listing as Listing, today) ? 1 : 0,
  };
  const w = FEED_RANKING.discover.weights;
  const score =
    parts.who * w.who +
    parts.what * w.what +
    parts.fresh * w.fresh +
    parts.quality * w.quality +
    parts.available * w.available;
  return { listingId: listing.id, score, parts };
}

/**
 * Listing ids, best first. Ties go to the newer piece, then the id, so
 * the grid never shuffles between renders.
 */
export function rankListings(
  listings: readonly Listing[],
  createdAtMs: (listing: Listing) => number | null,
  viewer: RankingViewer,
  nowMs: number,
  today: IsoDate,
): string[] {
  return listings
    .map((l) => ({
      id: l.id,
      created: createdAtMs(l) ?? 0,
      score: explainListingScore(l, createdAtMs(l), viewer, nowMs, today).score,
    }))
    .sort(
      (a, b) =>
        b.score - a.score || b.created - a.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((r) => r.id);
}

/**
 * Her occasion interest for Discover, from the pieces she has saved.
 * Same shape and cap as the feed's (`buildOccasionAffinity`).
 */
export function occasionsOfSaved(
  savedListingIds: readonly string[],
  byId: (id: string) => Pick<Listing, 'occasions'> | undefined,
): Occasion[][] {
  const out: Occasion[][] = [];
  for (const id of savedListingIds) {
    const l = byId(id);
    if (l) out.push(l.occasions ?? []);
  }
  return out;
}
