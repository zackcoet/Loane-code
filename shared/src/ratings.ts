/**
 * A person's rating, worked out from the reviews that are still showing.
 *
 * Shared by every place a review can be hidden or put back (the admin
 * Reviews page, and acting on a report about a review) so they can
 * never disagree about the number. It is RECOMPUTED from the reviews
 * rather than nudged up or down by arithmetic: nudging drifts the day
 * two admins act at once, and nothing ever corrects it.
 */
export interface RatingSummary {
  ratingCount: number;
  /** Rounded to two places. Null when nothing is left to average. */
  ratingAverage: number | null;
}

type RatedReview = { id: string; rating: number; isHidden: boolean };

function summarize(reviews: RatedReview[]): RatingSummary {
  const visible = reviews.filter((r) => !r.isHidden);
  const count = visible.length;
  if (count === 0) return { ratingCount: 0, ratingAverage: null };
  const sum = visible.reduce((total, r) => total + r.rating, 0);
  return { ratingCount: count, ratingAverage: Math.round((sum / count) * 100) / 100 };
}

/** Her rating once one review is hidden or put back. */
export function ratingFromVisible(
  reviews: RatedReview[],
  change: { id: string; hide: boolean },
): RatingSummary {
  return summarize(reviews.map((r) => (r.id === change.id ? { ...r, isHidden: change.hide } : r)));
}

/**
 * Her rating once one review is written or re-scored.
 *
 * Used by writing and editing a review, for the same reason as above:
 * the old way multiplied a ROUNDED average back up and nudged it, so
 * every review added a little error that nothing ever took away, and
 * re-scoring a review an admin had already taken down nudged a number
 * it was no longer part of. A review not in the list yet (a brand-new
 * one) is added, visible.
 */
export function ratingWithScore(
  reviews: RatedReview[],
  score: { id: string; rating: number },
): RatingSummary {
  const existing = reviews.find((r) => r.id === score.id);
  const others = reviews.filter((r) => r.id !== score.id);
  return summarize([
    ...others,
    { id: score.id, rating: score.rating, isHidden: existing?.isHidden ?? false },
  ]);
}
