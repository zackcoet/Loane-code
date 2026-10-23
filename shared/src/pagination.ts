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
  /** Followers and following lists, and who liked a look. */
  people: 30,
  /** Activity → Updates. */
  updates: 30,
  /**
   * People search: how many matches to fetch for what she typed. A few
   * more than we show, because suspended accounts and her own are
   * dropped on the phone after the fetch.
   */
  peopleSearch: 30,
  /** People search: how many matches to show. */
  peopleSearchShown: 20,
  /**
   * The Messages inbox: how many chats it holds at first, and how many
   * more each time she nears the bottom. The first window is the same
   * size as the badge's (INBOX_BADGE_WINDOW) so the two read the same
   * chats and the phone answers both from one copy.
   */
  inbox: 50,
} as const;

/**
 * How many of her most recently active chats the Messages badge reads.
 * Fixed, so scrolling the inbox never changes what the badge listens to.
 *
 * Why a fixed window is enough: anything that makes a chat unread (a
 * message, a heart on her message) also moves it to the top. A chat can
 * only be unread and outside the window if 50 other chats have had
 * something newer since — and then those are what she will open first.
 */
export const INBOX_BADGE_WINDOW = 50;

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
