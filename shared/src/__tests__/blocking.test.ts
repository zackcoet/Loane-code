import { describe, expect, it } from 'vitest';
import { isHiddenNotification, withoutBlocked } from '../blocking';

const BLOCKED = new Set(['uid-blocked']);

describe('isHiddenNotification', () => {
  it('hides a like, comment or follow from someone blocked', () => {
    for (const type of ['post_liked', 'post_commented', 'new_follower', 'new_message'] as const) {
      expect(isHiddenNotification({ type, actorUid: 'uid-blocked' }, BLOCKED)).toBe(true);
    }
  });

  it('keeps rental alerts even from someone blocked', () => {
    // A garment can still be due back after a block.
    for (const type of ['rental_upcoming', 'return_reminder', 'rental_accepted'] as const) {
      expect(isHiddenNotification({ type, actorUid: 'uid-blocked' }, BLOCKED)).toBe(false);
    }
  });

  it('keeps alerts from everyone else, and alerts with nobody behind them', () => {
    expect(isHiddenNotification({ type: 'post_liked', actorUid: 'uid-friend' }, BLOCKED)).toBe(
      false,
    );
    expect(isHiddenNotification({ type: 'admin_notice', actorUid: null }, BLOCKED)).toBe(false);
    expect(isHiddenNotification({ type: 'post_liked', actorUid: 'uid-blocked' }, new Set())).toBe(
      false,
    );
  });
});

describe('withoutBlocked', () => {
  const items = [
    { id: 'a', owner: 'uid-friend' },
    { id: 'b', owner: 'uid-blocked' },
    { id: 'c', owner: null },
  ];

  it('drops only items owned by someone blocked, keeping order', () => {
    expect(withoutBlocked(items, (i) => i.owner, BLOCKED).map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('returns the same list when nobody is blocked', () => {
    expect(withoutBlocked(items, (i) => i.owner, new Set())).toBe(items);
  });
});
