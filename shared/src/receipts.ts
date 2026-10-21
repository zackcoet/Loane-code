/**
 * Read receipts — "Seen" under the newest message, like Instagram.
 *
 * Here rather than in the chat screen so the rule for when to mark a
 * thread read and the rule for when to say "Seen" are written once,
 * next to each other, and tested.
 */

import { toMillis } from './dates';
import type { Conversation, Message } from './types';

type Thread = Pick<Conversation, 'unreadCounts' | 'lastReadAt'>;
type Msg = Pick<Message, 'id' | 'senderUid' | 'createdAt'>;

/**
 * What to show under the newest message, if it is hers.
 *
 * Only the newest: Instagram shows one receipt at the bottom of the
 * thread, and a "Seen" under every bubble is noise. Nothing at all when
 * the newest message is theirs — her reply is the receipt.
 *
 * `newestFirst` is the thread as the chat screen holds it.
 */
export function receiptFor(
  thread: Thread | null,
  newestFirst: Msg[],
  myUid: string | undefined,
  /**
   * Her "Show read receipts" setting. Off means she sees no receipts
   * either — the Instagram trade: you cannot hide yours and still
   * watch everyone else's.
   */
  receiptsOn = true,
): { messageId: string; label: 'Seen' | 'Sent' } | null {
  if (!thread || !myUid || !receiptsOn) return null;
  const newest = newestFirst[0];
  if (!newest || newest.senderUid !== myUid) return null;

  const sentAt = toMillis(newest.createdAt);
  // Still on its way to the server — the bubble itself says so.
  if (sentAt == null) return null;

  const seenAt = Object.entries(thread.lastReadAt ?? {})
    .filter(([uid]) => uid !== myUid)
    .map(([, at]) => toMillis(at))
    .filter((ms): ms is number => ms != null);

  const seen = seenAt.some((ms) => ms >= sentAt);
  return { messageId: newest.id, label: seen ? 'Seen' : 'Sent' };
}

/**
 * Whether opening the thread should write anything.
 *
 * Her badge is up, or the other person has said something since she
 * last had the thread open. Checking first matters because this runs on
 * every snapshot of an open chat, and a write per snapshot would loop.
 */
export function needsMarkRead(
  thread: Thread | null,
  newestFirst: Msg[],
  myUid: string | undefined,
  /** With receipts off only her badge is cleared, so only it matters. */
  receiptsOn = true,
): boolean {
  if (!thread || !myUid) return false;
  if ((thread.unreadCounts?.[myUid] ?? 0) > 0) return true;
  if (!receiptsOn) return false;

  const latestFromThem = newestFirst.find((m) => m.senderUid !== myUid);
  if (!latestFromThem) return false;
  const theirs = toMillis(latestFromThem.createdAt);
  if (theirs == null) return false;
  const mine = toMillis(thread.lastReadAt?.[myUid]);
  return mine == null || mine < theirs;
}
