/**
 * Grouping Activity → Updates the way Instagram does:
 * "@ella and 4 others liked your look" instead of five rows.
 *
 * Only the purely social alerts group, and only when they are about the
 * same thing — likes on one look, hearts on comments under one look, and
 * new followers. Rental alerts never group: each one is a step she may
 * have to act on, and folding them together would hide one.
 *
 * A group sits where its newest alert would, is unread if any alert in
 * it is unread, and counts people, not alerts — someone who liked, took
 * it back and liked again is one person.
 */

import type { NotificationType } from './constants';
import type { Notification } from './types';

const VERB: Partial<Record<NotificationType, string>> = {
  post_liked: 'liked your look',
  comment_liked: 'liked your comment',
  new_follower: 'followed you',
};

export interface NotificationGroup {
  /** Stable key for the list. */
  key: string;
  /** The newest alert in the group — its picture, time and link. */
  lead: Notification;
  /** Every alert in it, newest first. Marking the group read marks these. */
  members: Notification[];
  title: string;
  unread: boolean;
  /** How many different people are in it. */
  people: number;
}

function groupKey(n: Notification): string | null {
  if (!VERB[n.type] || !n.actorUid) return null;
  if (n.type === 'new_follower') return 'new_follower';
  return n.refs?.postId ? `${n.type}:${n.refs.postId}` : null;
}

/** Expects the list newest first, as the Activity listener reads it. */
export function groupNotifications(list: readonly Notification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const byKey = new Map<string, NotificationGroup>();

  for (const n of list) {
    const key = groupKey(n);
    const existing = key ? byKey.get(key) : undefined;
    if (existing) {
      existing.members.push(n);
      continue;
    }
    const group: NotificationGroup = {
      key: key ?? n.id,
      lead: n,
      members: [n],
      title: n.title,
      unread: false,
      people: 1,
    };
    groups.push(group);
    if (key) byKey.set(key, group);
  }

  for (const g of groups) {
    g.unread = g.members.some((m) => !m.readAt);
    g.people = new Set(g.members.map((m) => m.actorUid ?? m.id)).size;
    const verb = VERB[g.lead.type];
    if (verb && g.people > 1 && g.lead.actorUsername) {
      const others = g.people - 1;
      g.title = `@${g.lead.actorUsername} and ${others} ${others === 1 ? 'other' : 'others'} ${verb}`;
    }
  }
  return groups;
}

/**
 * Where tapping an alert should take her. Uses the ids on the alert
 * rather than its stored link so a link written before a route was
 * renamed still lands somewhere real.
 */
export function notificationTarget(n: Notification): string | null {
  if (n.refs?.bookingId) return `/rental/${n.refs.bookingId}`;
  if (n.type === 'new_follower' && n.actorUsername) {
    // Her account id rides along, because the @username on the alert is
    // a copy from the day she followed: if she renames herself later,
    // the name alone opens "Closet not found" — or whoever took it.
    return n.actorUid
      ? `/u/${encodeURIComponent(n.actorUsername)}?uid=${encodeURIComponent(n.actorUid)}`
      : `/u/${encodeURIComponent(n.actorUsername)}`;
  }
  if (n.refs?.postId) {
    // Comment alerts open the comments, where the thing to answer is.
    if (
      n.type === 'post_commented' ||
      n.type === 'comment_replied' ||
      n.type === 'mentioned' ||
      n.type === 'comment_liked'
    ) {
      const postId = encodeURIComponent(n.refs.postId);
      // "Commented on your look" goes to the look's author, so she may
      // delete comments there; for the others we do not know whose look
      // it is, and the comments sheet then only offers her own.
      return n.type === 'post_commented'
        ? `/comments?postId=${postId}&postAuthorUid=${encodeURIComponent(n.uid)}`
        : `/comments?postId=${postId}`;
    }
    return `/post/${n.refs.postId}`;
  }
  return null;
}
