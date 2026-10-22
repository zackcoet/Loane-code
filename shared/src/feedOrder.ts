/**
 * The order of the All Campus feed — NORTH_STAR D3 and D4.
 *
 * feedRanking.ts gives every look a score. This file turns scores into
 * the order she actually scrolls, with two extra rules and one promise:
 *
 *   1. VARIETY. Never more than `maxInARow` looks in a row from the same
 *      girl, however well her looks score. One prolific poster must not
 *      turn the feed into her profile.
 *   2. DISCOVERY. In every `discoveryEvery` looks, at least one is from
 *      someone she does not follow (while any are left), so a girl who
 *      follows twenty friends still meets new closets.
 *   3. NOTHING JUMPS. Once a look has a place, it keeps it. A like that
 *      lands while she is reading would otherwise change the score and
 *      shuffle the card out from under her thumb. Looks that arrive later
 *      slot in as a group: brand-new uploads at the top (where newest-first
 *      put them before), older pages at the bottom as she scrolls. The
 *      whole order is only worked out again when she pulls to refresh.
 *
 * Pure logic, tested in __tests__/feedOrder.test.ts.
 */

import { FEED_RANKING, rankPosts, type RankingInput } from './feedRanking';
import type { Post } from './types/post';

type RankablePost = Pick<Post, 'id' | 'authorUid' | 'occasions' | 'stats' | 'taggedListingIds'>;

export interface DiversityOptions {
  /** Is this author someone she follows (or herself)? Not "discovery". */
  isFamiliar: (authorUid: string) => boolean;
  maxInARow?: number;
  discoveryEvery?: number;
}

/**
 * Re-orders an already-ranked list as little as possible to obey the
 * variety and discovery rules. At each slot it takes the best-ranked
 * look that breaks no rule; if every remaining look breaks the
 * discovery rule it drops that rule for the slot, and if every one
 * breaks the variety rule too (only one girl left) it takes the best.
 * Nothing is ever dropped — only moved.
 *
 * `before` is the author of each look already on screen above this
 * group, oldest first, so a page appended at the bottom continues the
 * rules across the seam instead of starting a fresh count.
 */
export function diversifyFeed<P extends { authorUid: string }>(
  ranked: readonly P[],
  options: DiversityOptions,
  before: readonly string[] = [],
): P[] {
  const maxInARow = options.maxInARow ?? FEED_RANKING.diversity.maxInARow;
  const every = options.discoveryEvery ?? FEED_RANKING.diversity.discoveryEvery;
  const authors = [...before];
  const remaining = [...ranked];
  const out: P[] = [];

  const breaksVariety = (uid: string): boolean => {
    if (authors.length < maxInARow) return false;
    for (let i = authors.length - maxInARow; i < authors.length; i++) {
      if (authors[i] !== uid) return false;
    }
    return true;
  };
  // True when the last (every - 1) looks were all familiar, so this slot
  // must be a discovery look if one is left.
  const discoveryDue = (): boolean => {
    if (every <= 1) return true;
    if (authors.length < every - 1) return false;
    for (let i = authors.length - (every - 1); i < authors.length; i++) {
      if (!options.isFamiliar(authors[i]!)) return false;
    }
    return true;
  };

  while (remaining.length > 0) {
    const wantDiscovery = discoveryDue() && remaining.some((p) => !options.isFamiliar(p.authorUid));
    let pick = remaining.findIndex(
      (p) => !breaksVariety(p.authorUid) && (!wantDiscovery || !options.isFamiliar(p.authorUid)),
    );
    if (pick < 0) pick = remaining.findIndex((p) => !breaksVariety(p.authorUid));
    if (pick < 0) pick = 0;
    const [chosen] = remaining.splice(pick, 1);
    out.push(chosen!);
    authors.push(chosen!.authorUid);
  }
  return out;
}

/** Scores, then applies the variety and discovery rules. */
export function rankAndDiversify<P extends RankablePost>(
  posts: readonly P[],
  createdAtMs: (post: P) => number | null,
  input: RankingInput,
  before: readonly string[] = [],
): P[] {
  const familiar = (uid: string) => uid === input.viewer.uid || input.viewer.following.has(uid);
  const ranked = rankPosts(posts, createdAtMs, input).map((r) => r.post);
  return diversifyFeed(ranked, { isFamiliar: familiar }, before);
}

/**
 * The next feed order, given the order already on screen.
 *
 * - Looks that have gone (deleted, hidden, blocked) drop out.
 * - Looks already placed keep their place.
 * - New looks newer than everything placed are ranked among themselves
 *   and go on top; new looks older than that (the next page as she
 *   scrolls) are ranked among themselves and go at the bottom.
 * - With nothing placed yet, everything is ranked from scratch.
 *
 * Returns post ids, best first.
 */
export function nextFeedOrder<P extends RankablePost>(
  previous: readonly string[],
  posts: readonly P[],
  createdAtMs: (post: P) => number | null,
  input: RankingInput,
): string[] {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const kept = previous.filter((id) => byId.has(id));
  if (kept.length === 0) {
    return rankAndDiversify(posts, createdAtMs, input).map((p) => p.id);
  }

  const placed = new Set(kept);
  let newestPlaced = -Infinity;
  for (const id of kept) newestPlaced = Math.max(newestPlaced, createdAtMs(byId.get(id)!) ?? 0);

  const top: P[] = [];
  const bottom: P[] = [];
  for (const p of posts) {
    if (placed.has(p.id)) continue;
    // A look still being written has no time yet: it is brand new.
    const t = createdAtMs(p);
    (t === null || t > newestPlaced ? top : bottom).push(p);
  }
  if (top.length === 0 && bottom.length === 0) return kept;

  const authorOf = (id: string) => byId.get(id)!.authorUid;
  const bottomRanked = rankAndDiversify(bottom, createdAtMs, input, kept.map(authorOf));
  const topRanked = rankAndDiversify(top, createdAtMs, input);
  return [...topRanked.map((p) => p.id), ...kept, ...bottomRanked.map((p) => p.id)];
}
