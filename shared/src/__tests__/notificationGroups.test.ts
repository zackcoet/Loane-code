import { describe, expect, it } from 'vitest';
import { groupNotifications, notificationTarget } from '../notificationGroups';
import type { Notification } from '../types';
import type { NotificationType } from '../constants';

let seq = 0;
function n(
  type: NotificationType,
  actor: string | null,
  refs: Notification['refs'] = {},
  read = false,
): Notification {
  seq += 1;
  return {
    id: `n${seq}`,
    uid: 'uid-ella',
    type,
    title: actor ? `@${actor} did ${type}` : type,
    body: '',
    actorUid: actor ? `uid-${actor}` : null,
    actorUsername: actor,
    actorPhotoUrl: null,
    deepLink: null,
    refs,
    readAt: read ? ({ seconds: 1 } as never) : null,
    pushSentAt: null,
    createdAt: null as never,
    updatedAt: null as never,
  };
}

describe('groupNotifications', () => {
  it('folds likes on one look into one row, counting people', () => {
    const list = [
      n('post_liked', 'maddie', { postId: 'p1' }),
      n('post_liked', 'harper', { postId: 'p1' }, true),
      n('post_liked', 'maddie', { postId: 'p1' }, true),
      n('post_liked', 'sloane', { postId: 'p1' }, true),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('@maddie and 2 others liked your look');
    expect(groups[0]?.members).toHaveLength(4);
    expect(groups[0]?.unread).toBe(true);
  });

  it('keeps different looks apart and sits each group at its newest alert', () => {
    const list = [
      n('post_liked', 'maddie', { postId: 'p1' }),
      n('post_liked', 'harper', { postId: 'p2' }),
      n('post_liked', 'sloane', { postId: 'p1' }),
    ];
    const groups = groupNotifications(list);
    expect(groups.map((g) => g.lead.refs.postId)).toEqual(['p1', 'p2']);
    expect(groups[0]?.title).toBe('@maddie and 1 other liked your look');
  });

  it('never folds rental alerts or comments', () => {
    const list = [
      n('rental_requested', 'maddie', { bookingId: 'b1' }),
      n('rental_requested', 'harper', { bookingId: 'b1' }),
      n('post_commented', 'maddie', { postId: 'p1' }),
      n('post_commented', 'harper', { postId: 'p1' }),
    ];
    expect(groupNotifications(list)).toHaveLength(4);
  });

  it('folds new followers together', () => {
    const groups = groupNotifications([
      n('new_follower', 'maddie', {}, true),
      n('new_follower', 'harper', {}, true),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('@maddie and 1 other followed you');
    expect(groups[0]?.unread).toBe(false);
  });

  it('leaves a single alert with its own wording', () => {
    const one = n('post_liked', 'maddie', { postId: 'p1' });
    expect(groupNotifications([one])[0]?.title).toBe(one.title);
  });
});

describe('notificationTarget', () => {
  it('sends each kind somewhere sensible', () => {
    expect(notificationTarget(n('rental_accepted', null, { bookingId: 'b1' }))).toBe('/rental/b1');
    expect(notificationTarget(n('new_follower', 'maddie'))).toBe('/u/maddie?uid=uid-maddie');
    expect(notificationTarget(n('post_liked', 'maddie', { postId: 'p1' }))).toBe('/post/p1');
    expect(notificationTarget(n('mentioned', 'maddie', { postId: 'p1' }))).toBe(
      '/comments?postId=p1',
    );
    expect(notificationTarget(n('post_commented', 'maddie', { postId: 'p1' }))).toBe(
      '/comments?postId=p1&postAuthorUid=uid-ella',
    );
    expect(notificationTarget(n('admin_notice', null))).toBeNull();
  });

  it('a follow alert still opens the right closet after she renames herself', () => {
    // The alert keeps the name she had that day; the account id is what
    // the profile screen trusts.
    const alert = n('new_follower', 'maddie');
    expect(notificationTarget(alert)).toContain('uid=uid-maddie');
    // An old alert with no account id falls back to the name.
    expect(notificationTarget({ ...alert, actorUid: null })).toBe('/u/maddie');
  });
});
