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

export function ratingFromVisible(
  reviews: { id: string; rating: number; isHidden: boolean }[],
  change: { id: string; hide: boolean },
): RatingSummary {
  const visible = reviews.filter((r) => (r.id === change.id ? !change.hide : !r.isHidden));
  const count = visible.length;
  if (count === 0) return { ratingCount: 0, ratingAverage: null };
  const sum = visible.reduce((total, r) => total + r.rating, 0);
  return { ratingCount: count, ratingAverage: Math.round((sum / count) * 100) / 100 };
}
