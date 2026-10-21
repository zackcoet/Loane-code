/**
 * The inbox — which threads she sees where, and what counts toward her
 * badge.
 *
 * Here rather than in the screen so the inbox, the Requests folder and
 * the tab badge all agree, and so the rules can be tested without a
 * phone. Every function treats a missing field as "the old behaviour",
 * because threads from before these features have none of them.
 */

import { toMillis } from './dates';
import type { Conversation } from './types';

type Thread = Pick<
  Conversation,
  | 'participantUids'
  | 'bookingId'
  | 'lastMessage'
  | 'unreadCounts'
  | 'hiddenAt'
  | 'mutedUids'
  | 'repliedUids'
>;

/**
 * She deleted the thread and nothing new has arrived since.
 *
 * A thread with no messages at all and a delete on it stays hidden;
 * one whose newest message is still on its way (no server time yet) is
 * shown, because it can only be newer than the delete.
 */
export function isHiddenFor(thread: Thread, uid: string): boolean {
  const hiddenMs = toMillis(thread.hiddenAt?.[uid]);
  if (hiddenMs == null) return false;
  if (!thread.lastMessage) return true;
  const lastMs = toMillis(thread.lastMessage.sentAt);
  if (lastMs == null) return false;
  return lastMs <= hiddenMs;
}

export function isMutedFor(thread: Pick<Conversation, 'mutedUids'>, uid: string): boolean {
  return (thread.mutedUids ?? []).includes(uid);
}

/**
 * A message request: someone she does not follow wrote to her, and she
 * has never written back.
 *
 * Never a request:
 * - a thread from before requests existed (no `repliedUids`);
 * - a thread a rental started — that is business, not a stranger;
 * - a thread nobody has written in yet (an empty thread she opened).
 */
export function isRequestFor(thread: Thread, uid: string, followingUids: Set<string>): boolean {
  if (!thread.repliedUids) return false;
  if (thread.bookingId) return false;
  if (thread.repliedUids.includes(uid)) return false;
  const other = thread.participantUids.find((p) => p !== uid);
  if (!other) return false;
  // Nobody has written anything: there is nothing to request.
  if (!thread.repliedUids.includes(other)) return false;
  return !followingUids.has(other);
}

/**
 * Splits the loaded threads into her inbox and her Requests folder,
 * dropping the ones she deleted. Order is kept.
 */
export function splitInbox<T extends Thread>(
  threads: T[],
  uid: string,
  followingUids: Set<string>,
): { inbox: T[]; requests: T[] } {
  const inbox: T[] = [];
  const requests: T[] = [];
  for (const t of threads) {
    if (isHiddenFor(t, uid)) continue;
    if (isRequestFor(t, uid, followingUids)) requests.push(t);
    else inbox.push(t);
  }
  return { inbox, requests };
}

/**
 * The number on the Messages badge.
 *
 * Muted threads, deleted threads and requests do not count — the badge
 * is for people she has chosen to hear from. Requests show their own
 * count on the Requests row instead.
 */
export function inboxUnreadTotal(
  threads: Thread[],
  uid: string,
  followingUids: Set<string>,
): number {
  return splitInbox(threads, uid, followingUids).inbox.reduce(
    (total, t) => total + (isMutedFor(t, uid) ? 0 : (t.unreadCounts?.[uid] ?? 0)),
    0,
  );
}

/**
 * Whether a message should show in a thread she once deleted. Only what
 * came after the delete — the old history stays gone for her.
 */
export function visibleAfterDelete(
  thread: Pick<Conversation, 'hiddenAt'> | null,
  uid: string | undefined,
  createdAt: unknown,
): boolean {
  if (!thread || !uid) return true;
  const hiddenMs = toMillis(thread.hiddenAt?.[uid]);
  if (hiddenMs == null) return true;
  const ms = toMillis(createdAt);
  // Still on its way to the server: it is new.
  if (ms == null) return true;
  return ms > hiddenMs;
}
