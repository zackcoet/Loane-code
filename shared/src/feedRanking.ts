/**
 * The "For You" ranking score — NORTH_STAR D2.
 *
 * One number per look for one student, built from five parts that each
 * land between 0 and 1 so their weights mean something:
 *
 *   who        she follows the author, they follow each other, she has
 *              liked / saved / commented on the author's looks before
 *   what       the look's occasions match the occasions she engages with
 *   fresh      newer looks first; halves every `freshHalfLifeHours`
 *   quality    engagement RATE — how much each person who saw it did
 *              something — not raw likes, so a new look with 4 likes from
 *              10 views beats an old one with 30 from 600
 *   available  the pieces tagged in it can actually be rented or bought
 *              this week, because a look she cannot get is a dead end
 *
 * WHERE IT RUNS, AND WHY THAT IS SAFE. On her phone, over a page of the
 * newest campus looks. The parts that are about HER (who, what) come
 * from her own follows and likes, so the most a student can do by
 * tampering is reorder her own feed. The parts that are about the LOOK
 * (quality, available) come only from server-written counters and from
 * listings the security rules stop her editing — so no one can push her
 * own look up anyone else's feed. See docs/decisions.md (run 15).
 *
 * Pure logic, no React and no Firebase, so it is tested here and every
 * number can be explained by `explainScore`.
 */

import type { Occasion } from './constants';
import { addDays, unavailableDates } from './dates';
import type { IsoDate } from './types/common';
import type { Listing } from './types/listing';
import type { Post } from './types/post';

/**
 * Every tunable number in one place. Changing the feed means changing
 * this object, and docs/feed-algorithm.md explains each one.
 */
export const FEED_RANKING = {
  /** How much each part counts. Each part is 0..1 before weighting. */
  weights: {
    who: 1.0,
    what: 0.6,
    fresh: 1.2,
    quality: 0.8,
    available: 0.4,
  },
  who: {
    /** She follows the author. */
    following: 0.6,
    /** …and the author follows her back. */
    mutualBonus: 0.2,
    /** Per past like / save / comment on this author's looks. */
    perInteraction: 0.05,
    /**
     * Ceiling on the interaction part, so liking every one of one
     * friend's looks does not bury everybody else.
     */
    interactionMax: 0.2,
  },
  /** A look loses half its freshness every this many hours. */
  freshHalfLifeHours: 36,
  quality: {
    /** What one of each action is worth. A tag tap is the headline metric. */
    actionWeights: { like: 1, save: 2, comment: 3, share: 3, tagTap: 4 },
    /**
     * Pretend every look starts with this many viewers at `priorRate`,
     * so a look with 1 view and 1 like is not "100%" and top of campus.
     */
    priorReach: 20,
    priorRate: 0.1,
    /** A weighted rate at or above this scores the full 1. */
    fullRate: 0.6,
  },
  available: {
    /** "Available" means at least one free start day in this many days. */
    lookaheadDays: 7,
  },
  /** D3 — the rules applied AFTER scoring. See feedOrder.ts. */
  diversity: {
    /** Never more than this many looks in a row from the same girl. */
    maxInARow: 2,
    /**
     * In every run of this many looks, at least one is from someone she
     * does not follow (when there is one left to show), so the feed keeps
     * introducing her to new closets instead of closing in on friends.
     */
    discoveryEvery: 4,
  },
} as const;

/** What the phone knows about HER. All of it is her own data. */
export interface RankingViewer {
  uid: string;
  /** People she follows. */
  following: ReadonlySet<string>;
  /** People who follow her (for "mutual"). */
  followers: ReadonlySet<string>;
  /** Author uid → how many of their looks she has liked, saved or commented on. */
  interactions: ReadonlyMap<string, number>;
  /** Occasion → how strongly she engages with it. Any scale; it is normalised. */
  occasionAffinity: ReadonlyMap<Occasion, number>;
}

/** What the phone knows about the pieces tagged in a look. */
export type ListingLookup = (listingId: string) => Listing | undefined;

export interface ScoreBreakdown {
  postId: string;
  score: number;
  parts: { who: number; what: number; fresh: number; quality: number; available: number };
}

export interface RankingInput {
  viewer: RankingViewer;
  listings: ListingLookup;
  nowMs: number;
  today: IsoDate;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Who posted it, relative to her. */
export function whoPart(authorUid: string, viewer: RankingViewer): number {
  if (authorUid === viewer.uid) return 0;
  const cfg = FEED_RANKING.who;
  let part = 0;
  if (viewer.following.has(authorUid)) {
    part += cfg.following;
    if (viewer.followers.has(authorUid)) part += cfg.mutualBonus;
  }
  const times = viewer.interactions.get(authorUid) ?? 0;
  part += Math.min(cfg.interactionMax, times * cfg.perInteraction);
  return clamp01(part);
}

/**
 * How well the look's occasions match hers: the best-matching occasion's
 * share of her strongest one. A look tagged Gameday for a girl who mostly
 * likes Gameday looks scores 1; one tagged Wedding scores her Wedding
 * interest relative to that.
 */
export function whatPart(occasions: readonly Occasion[], viewer: RankingViewer): number {
  let strongest = 0;
  for (const v of viewer.occasionAffinity.values()) strongest = Math.max(strongest, v);
  if (strongest <= 0 || occasions.length === 0) return 0;
  let best = 0;
  for (const o of occasions) best = Math.max(best, viewer.occasionAffinity.get(o) ?? 0);
  return clamp01(best / strongest);
}

/** 1 when just posted, 0.5 after one half-life, 0.25 after two. */
export function freshPart(createdAtMs: number | null, nowMs: number): number {
  if (createdAtMs === null) return 0;
  const hours = Math.max(0, nowMs - createdAtMs) / 3_600_000;
  return clamp01(Math.pow(0.5, hours / FEED_RANKING.freshHalfLifeHours));
}

/**
 * Engagement per viewer, smoothed. Reads only `post.stats`, which only
 * Cloud Functions can write.
 *
 * "Viewers" is opens plus likes: a like from the feed does not open the
 * look, so opens alone would undercount the people who saw it. When
 * feed impressions are counted on the server this becomes impressions.
 */
export function qualityPart(stats: Post['stats']): number {
  const cfg = FEED_RANKING.quality;
  const w = cfg.actionWeights;
  const engagement =
    stats.likeCount * w.like +
    stats.saveCount * w.save +
    stats.commentCount * w.comment +
    (stats.shareCount ?? 0) * w.share +
    stats.tagTapCount * w.tagTap;
  const reach = Math.max(0, stats.viewCount) + Math.max(0, stats.likeCount);
  const rate = (engagement + cfg.priorRate * cfg.priorReach) / (reach + cfg.priorReach);
  return clamp01(rate / cfg.fullRate);
}

/**
 * Whether one tagged piece can be had this week: it is up, and either
 * it is for sale or it has at least one free start day in the next
 * `lookaheadDays` (not booked, not blacked out).
 */
export function isListingAvailableSoon(listing: Listing, today: IsoDate): boolean {
  if (listing.status !== 'active') return false;
  if (listing.intent === 'sell' || listing.intent === 'both') {
    if (listing.salePriceCents !== null) return true;
  }
  if (listing.intent === 'sell') return false;
  // bookedDates is already the day-by-day shadow of confirmed bookings.
  const taken = unavailableDates(
    [...(listing.blackoutDates ?? []), ...(listing.bookedDates ?? [])],
    [],
  );
  for (let i = 0; i < FEED_RANKING.available.lookaheadDays; i++) {
    if (!taken.has(addDays(today, i))) return true;
  }
  return false;
}

/** Share of the look's tagged pieces she could get this week. 0 when nothing is tagged. */
export function availablePart(
  taggedListingIds: readonly string[],
  listings: ListingLookup,
  today: IsoDate,
): number {
  if (taggedListingIds.length === 0) return 0;
  let ok = 0;
  for (const id of taggedListingIds) {
    const listing = listings(id);
    if (listing && isListingAvailableSoon(listing, today)) ok++;
  }
  return ok / taggedListingIds.length;
}

/** The score for one look, with every part shown. */
export function explainScore(
  post: Pick<Post, 'id' | 'authorUid' | 'occasions' | 'stats' | 'taggedListingIds'> & {
    createdAtMs: number | null;
  },
  input: RankingInput,
): ScoreBreakdown {
  const parts = {
    who: whoPart(post.authorUid, input.viewer),
    what: whatPart(post.occasions ?? [], input.viewer),
    fresh: freshPart(post.createdAtMs, input.nowMs),
    quality: qualityPart(post.stats),
    available: availablePart(post.taggedListingIds ?? [], input.listings, input.today),
  };
  const w = FEED_RANKING.weights;
  const score =
    parts.who * w.who +
    parts.what * w.what +
    parts.fresh * w.fresh +
    parts.quality * w.quality +
    parts.available * w.available;
  return { postId: post.id, score, parts };
}

/**
 * Highest score first. Ties go to the newer look, then to the id, so the
 * order never shuffles between renders.
 */
export function rankPosts<
  P extends Pick<Post, 'id' | 'authorUid' | 'occasions' | 'stats' | 'taggedListingIds'>,
>(
  posts: readonly P[],
  createdAtMs: (post: P) => number | null,
  input: RankingInput,
): { post: P; breakdown: ScoreBreakdown }[] {
  return posts
    .map((post) => ({
      post,
      created: createdAtMs(post) ?? 0,
      breakdown: explainScore({ ...post, createdAtMs: createdAtMs(post) }, input),
    }))
    .sort(
      (a, b) =>
        b.breakdown.score - a.breakdown.score ||
        b.created - a.created ||
        (a.post.id < b.post.id ? -1 : a.post.id > b.post.id ? 1 : 0),
    )
    .map(({ post, breakdown }) => ({ post, breakdown }));
}

/**
 * Builds her occasion interest from the occasions of looks she liked,
 * saved or commented on. Each look counts once per occasion, and each
 * occasion is capped so one binge on Rush looks does not decide her
 * whole feed forever.
 */
export function buildOccasionAffinity(
  engagedLookOccasions: readonly (readonly Occasion[])[],
  capPerOccasion = 20,
): Map<Occasion, number> {
  const out = new Map<Occasion, number>();
  for (const occasions of engagedLookOccasions) {
    for (const o of new Set(occasions)) {
      out.set(o, Math.min(capPerOccasion, (out.get(o) ?? 0) + 1));
    }
  }
  return out;
}
