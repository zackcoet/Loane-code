/**
 * Loading a long list a page at a time.
 *
 * The pattern every paged list in Loane follows: the newest page is a
 * live listener (so a new message, a like or a takedown shows up at
 * once), and older pages are fetched once, as she scrolls to them.
 */

/** How many items a page holds, per list. One place to tune them. */
export const PAGE_SIZES = {
  /** A chat: enough to fill two screens of bubbles. */
  messages: 40,
  /** A post's comments. */
  comments: 30,
  /** Followers and following lists. */
  people: 30,
  /**
   * People search: how many matches to fetch for what she typed. A few
   * more than we show, because suspended accounts and her own are
   * dropped on the phone after the fetch.
   */
  peopleSearch: 30,
  /** People search: how many matches to show. */
  peopleSearchShown: 20,
} as const;

/**
 * The live page and the older pages as one list, newest first, each
 * item once. An item can briefly be in both — the live page grows down
 * over the boundary as she scrolls — and the live copy wins, because it
 * is the up-to-date one.
 */
export function mergePages<T extends { id: string }>(live: T[], older: T[]): T[] {
  const seen = new Set(live.map((x) => x.id));
  return [...live, ...older.filter((x) => !seen.has(x.id))];
}

/** A page that came back short means there is nothing further back. */
export function isLastPage(received: number, pageSize: number): boolean {
  return received < pageSize;
}
