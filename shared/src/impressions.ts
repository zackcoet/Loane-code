/**
 * Impressions and dwell — what she scrolled past, and for how long.
 *
 * The feed algorithm (NORTH_STAR D2) needs to know what she saw and
 * skipped, not only what she tapped. A like says "loved it"; a post she
 * paused on for six seconds without liking is still a strong signal, and
 * one she flicked past in a quarter of a second is a weak "no".
 *
 * One `post_impression` event per post per app session, written when the
 * post leaves the screen, carrying the total time it was on screen. Not
 * one per scroll: a girl scrolling up and down the same ten looks would
 * otherwise write hundreds of rows that say nothing new.
 *
 * Pure logic, no React and no Firebase, so it is tested here and the
 * feed screen only wires it up.
 */

export const IMPRESSION = {
  /**
   * Shorter than this is a flick, not a look. Instagram-style feeds use
   * roughly the same bar; anything faster is the post rushing past on
   * the way to somewhere else.
   */
  minDwellMs: 300,
  /**
   * A cap so a phone left on the feed while she makes coffee does not
   * read as the most-loved post on campus.
   */
  maxDwellMs: 60_000,
  /** How much of the post must be on screen to count as seen. */
  viewablePercent: 50,
} as const;

export interface FinishedImpression {
  postId: string;
  dwellMs: number;
  /** Where in the list it was (0 = top), so ranking can correct for position. */
  position: number;
}

/**
 * Tracks which posts are on screen and reports each one once, when it
 * leaves. `now` is passed in rather than read from the clock so the
 * tests can control time.
 */
export class ImpressionTracker {
  private visible = new Map<string, { since: number; position: number }>();
  private reported = new Set<string>();

  /**
   * Call with the full set of posts on screen right now (FlatList's
   * onViewableItemsChanged gives exactly that). Returns the impressions
   * that just finished.
   */
  update(onScreen: { postId: string; position: number }[], now: number): FinishedImpression[] {
    const ids = new Set(onScreen.map((p) => p.postId));
    const finished: FinishedImpression[] = [];
    for (const [postId, entry] of this.visible) {
      if (!ids.has(postId)) {
        this.visible.delete(postId);
        const done = this.finish(postId, entry, now);
        if (done) finished.push(done);
      }
    }
    for (const p of onScreen) {
      if (!this.visible.has(p.postId) && !this.reported.has(p.postId)) {
        this.visible.set(p.postId, { since: now, position: p.position });
      }
    }
    return finished;
  }

  /**
   * Everything on screen ends now — she left the tab, switched Following
   * / All Campus, or put the app in the background. Without this the
   * post she was looking at when she left would never be recorded.
   */
  flush(now: number): FinishedImpression[] {
    const finished: FinishedImpression[] = [];
    for (const [postId, entry] of this.visible) {
      const done = this.finish(postId, entry, now);
      if (done) finished.push(done);
    }
    this.visible.clear();
    return finished;
  }

  private finish(
    postId: string,
    entry: { since: number; position: number },
    now: number,
  ): FinishedImpression | null {
    const dwell = now - entry.since;
    // A flick is not reported, and not remembered either — if she comes
    // back and actually looks, that look should count.
    if (dwell < IMPRESSION.minDwellMs) return null;
    this.reported.add(postId);
    return {
      postId,
      dwellMs: Math.min(Math.round(dwell), IMPRESSION.maxDwellMs),
      position: entry.position,
    };
  }
}
