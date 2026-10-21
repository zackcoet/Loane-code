import { describe, expect, it } from 'vitest';
import {
  BOOKING_STATUSES_BLOCKING_DELETION,
  DELETED_ACCOUNT_NAME,
  accountDeletionBlockedMessage,
  blocksAccountDeletion,
  deletedUserSummary,
  deletedUsername,
  isDeletedAccount,
  isDeletedSummary,
  signedInRecently,
} from '../accountDeletion';
import { BOOKING_STATUSES } from '../constants';
import { validateUsername } from '../validation';

describe('deletedUsername', () => {
  it('is lowercase, unique per account, and a valid length', () => {
    const a = deletedUsername('AbCdEfGhIjKlMnOp');
    expect(a).toBe('deleted_abcdefghij');
    expect(deletedUsername('zzzzzzzzzzzz')).not.toBe(a);
    expect(a.length).toBeLessThanOrEqual(30);
  });

  it('cannot be chosen by anyone signing up', () => {
    expect(validateUsername(deletedUsername('abc123xyz789')).ok).toBe(false);
    expect(validateUsername('deleted_ella').ok).toBe(false);
    // The plain word is still fine — only the prefix is held back.
    expect(validateUsername('deletedscenes').ok).toBe(true);
  });
});

describe('deletedUserSummary', () => {
  it('carries no name, photo or verified badge', () => {
    const s = deletedUserSummary('uid-ella', 'university-of-south-carolina');
    expect(s).toEqual({
      uid: 'uid-ella',
      username: deletedUsername('uid-ella'),
      displayName: DELETED_ACCOUNT_NAME,
      photoUrl: null,
      campusId: 'university-of-south-carolina',
      isVerified: false,
    });
  });
});

describe('isDeletedAccount', () => {
  it('needs both the status and the timestamp', () => {
    expect(isDeletedAccount({ status: 'deactivated', deletedAt: 123 })).toBe(true);
    expect(isDeletedAccount({ status: 'deactivated' })).toBe(false);
    expect(isDeletedAccount({ status: 'active', deletedAt: null })).toBe(false);
  });
});

describe('blocksAccountDeletion', () => {
  it('blocks while a garment is spoken for, out, coming back or under a claim', () => {
    for (const s of ['requested', 'confirmed', 'with_renter', 'returned', 'disputed'] as const) {
      expect(blocksAccountDeletion(s)).toBe(true);
    }
  });

  it('allows once every rental is over', () => {
    for (const s of ['declined', 'cancelled', 'completed'] as const) {
      expect(blocksAccountDeletion(s)).toBe(false);
    }
  });

  it('only names real booking statuses', () => {
    for (const s of BOOKING_STATUSES_BLOCKING_DELETION) {
      expect(BOOKING_STATUSES).toContain(s);
    }
  });
});

describe('accountDeletionBlockedMessage', () => {
  it('reads naturally for one and for several', () => {
    expect(accountDeletionBlockedMessage(1)).toBe(
      'You have a rental still going. Finish or cancel it in My Rentals, then you can delete your account.',
    );
    expect(accountDeletionBlockedMessage(3)).toContain('3 rentals still going');
    expect(accountDeletionBlockedMessage(3)).toContain('cancel them');
  });
});

describe('signedInRecently', () => {
  const NOW = 1_800_000_000_000;
  it('accepts a sign-in from the last five minutes', () => {
    expect(signedInRecently(NOW / 1000 - 10, NOW)).toBe(true);
    expect(signedInRecently(NOW / 1000 - 299, NOW)).toBe(true);
  });

  it('refuses an old sign-in or a missing one', () => {
    expect(signedInRecently(NOW / 1000 - 301, NOW)).toBe(false);
    expect(signedInRecently(undefined, NOW)).toBe(false);
    expect(signedInRecently(Number.NaN, NOW)).toBe(false);
  });

  it('allows a little clock drift but not a sign-in from the future', () => {
    expect(signedInRecently(NOW / 1000 + 30, NOW)).toBe(true);
    expect(signedInRecently(NOW / 1000 + 600, NOW)).toBe(false);
  });
});

describe('isDeletedSummary', () => {
  it('spots a copy of a deleted profile by its handle', () => {
    expect(isDeletedSummary(deletedUserSummary('uid-ella', 'c'))).toBe(true);
    expect(isDeletedSummary({ username: 'ellapetrick' })).toBe(false);
    expect(isDeletedSummary(undefined)).toBe(false);
  });
});
