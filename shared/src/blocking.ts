/**
 * What blocking hides on her phone.
 *
 * The server refuses contact between blocked people (messages, likes,
 * comments, follows, rentals). This file is the other half: which
 * things already on her phone should quietly disappear. `blockedUids`
 * is always both directions — people she blocked AND people who blocked
 * her — so blocking works the same from either side.
 *
 * See docs/security.md, "Blocking: what it does and does not do".
 */

import type { NotificationType } from './constants';

/**
 * Alerts that are purely social. One of these from a blocked person is
 * hidden. Rental and claim alerts are NOT in this list on purpose: a
 * rental that was already under way when she blocked still has steps
 * (handoff, return, review), and hiding the reminder would leave her
 * not knowing a garment is due back.
 */
export const SOCIAL_NOTIFICATION_TYPES: readonly NotificationType[] = [
  'new_follower',
  'post_liked',
  'post_commented',
  'comment_liked',
  'comment_replied',
  'mentioned',
  'new_message',
];

/** Should this alert be hidden from her because of a block? */
export function isHiddenNotification(
  n: { type: NotificationType; actorUid: string | null },
  blockedUids: Set<string>,
): boolean {
  if (!n.actorUid || blockedUids.size === 0) return false;
  return blockedUids.has(n.actorUid) && SOCIAL_NOTIFICATION_TYPES.includes(n.type);
}

/** Drops everything authored by someone blocked either way. Order kept. */
export function withoutBlocked<T>(
  items: T[],
  ownerOf: (item: T) => string | null | undefined,
  blockedUids: Set<string>,
): T[] {
  if (blockedUids.size === 0) return items;
  return items.filter((item) => {
    const owner = ownerOf(item);
    return !owner || !blockedUids.has(owner);
  });
}
