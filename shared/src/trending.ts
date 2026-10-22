/**
 * "Trending on campus this week" — NORTH_STAR D5.
 *
 * Lifetime counters (`listing.stats`) can't say "this week", so a
 * scheduled Cloud Function (`refreshTrending`) reads the last seven days
 * of three signals per campus and hands them to `rankTrending` below.
 * The result is one small document, `trending/{campusId}`, that Discover
 * reads.
 *
 * WHY IT CAN'T BE GAMED (much):
 * - Each person counts ONCE per piece per kind of signal, however many
 *   times she taps or saves and unsaves. One girl hammering a piece
 *   moves it by at most one save + one tap + one request.
 * - The owner's own actions never count for her own piece.
 * - A piece needs `minPeople` different students before it can trend at
 *   all, so one friend can't put a piece on the list.
 * - Saves and requests come from documents only Cloud Functions write
 *   (`saves`, `bookings`). Tag taps are phone-written events, so they get
 *   the smallest weight.
 */

import type { ListingStatus } from './constants';
import type { Timestampish } from './types/common';

export const TRENDING = {
  /** How far back "this week" looks. */
  windowDays: 7,
  /** How many pieces the row shows at most. */
  size: 10,
  /** Different students needed before a piece can trend. */
  minPeople: 2,
  /** Points per distinct person, per kind of signal. */
  weights: {
    /** Saved the piece (server-written `saves`). */
    save: 2,
    /** Tapped it in a look (phone-written event — trusted least). */
    tap: 1,
    /** Asked to rent or buy it (server-written `bookings`). */
    request: 4,
  },
  /** Rows the server reads per signal per campus, at most, per run. */
  readCap: 5000,
} as const;

export type TrendingSignalKind = keyof typeof TRENDING.weights;

export interface TrendingSignal {
  kind: TrendingSignalKind;
  /** Who did it. */
  uid: string;
  listingId: string;
}

export interface TrendingListingInfo {
  id: string;
  ownerUid: string;
  status: ListingStatus;
}

export interface TrendingItem {
  listingId: string;
  score: number;
  /** How many different students did anything with it this week. */
  people: number;
}

/**
 * The week's top pieces, best first. Ties go to the piece more people
 * touched, then to the id so the order is stable between runs.
 */
export function rankTrending(
  signals: readonly TrendingSignal[],
  listings: ReadonlyMap<string, TrendingListingInfo>,
  size: number = TRENDING.size,
): TrendingItem[] {
  // listingId -> kind -> set of uids. Sets make "once per person" exact.
  const seen = new Map<string, Map<TrendingSignalKind, Set<string>>>();

  for (const s of signals) {
    const listing = listings.get(s.listingId);
    if (!listing || listing.status !== 'active') continue;
    if (!s.uid || s.uid === listing.ownerUid) continue;
    let byKind = seen.get(s.listingId);
    if (!byKind) {
      byKind = new Map();
      seen.set(s.listingId, byKind);
    }
    let uids = byKind.get(s.kind);
    if (!uids) {
      uids = new Set();
      byKind.set(s.kind, uids);
    }
    uids.add(s.uid);
  }

  const items: TrendingItem[] = [];
  for (const [listingId, byKind] of seen) {
    const everyone = new Set<string>();
    let score = 0;
    for (const [kind, uids] of byKind) {
      score += uids.size * TRENDING.weights[kind];
      for (const uid of uids) everyone.add(uid);
    }
    if (everyone.size < TRENDING.minPeople) continue;
    items.push({ listingId, score, people: everyone.size });
  }

  items.sort(
    (a, b) =>
      b.score - a.score ||
      b.people - a.people ||
      (a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0),
  );
  return items.slice(0, Math.max(0, size));
}

/**
 * `trending/{campusId}`
 *
 * Written only by the `refreshTrending` Cloud Function, every hour.
 * Readable by any signed-in student. Holds ids, not copies of the
 * pieces: Discover already has every active piece on her campus loaded,
 * and looking them up there keeps blocked closets and sold pieces out
 * without a second read.
 */
export interface TrendingDoc {
  campusId: string;
  items: TrendingItem[];
  windowDays: number;
  /** When the function last worked it out. */
  computedAt: Timestampish;
}
