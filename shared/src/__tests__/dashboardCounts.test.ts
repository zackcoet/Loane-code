import { describe, expect, it } from 'vitest';
import {
  isCountedListing,
  isCountedPost,
  isCurrentStudent,
  isStudentAccount,
} from '../dashboardCounts';
import { LISTING_STATUSES, POST_STATUSES } from '../constants';

describe('dashboard counts', () => {
  it('never counts an admin as a student or a sign-up', () => {
    expect(isStudentAccount({ role: 'admin' })).toBe(false);
    expect(isCurrentStudent({ role: 'admin', status: 'active' })).toBe(false);
  });

  it('keeps a deleted student as a sign-up but not as a current student', () => {
    const deleted = { role: 'student', status: 'deactivated' } as const;
    expect(isStudentAccount(deleted)).toBe(true);
    expect(isCurrentStudent(deleted)).toBe(false);
  });

  it('still counts a suspended student — she is paused, not gone', () => {
    expect(isCurrentStudent({ role: 'student', status: 'suspended' })).toBe(true);
  });

  it('treats an account from before roles existed as a student', () => {
    const old = { status: 'active' } as unknown as Parameters<typeof isCurrentStudent>[0];
    expect(isCurrentStudent(old)).toBe(true);
  });

  it('counts pieces on a closet now, not drafts, removed or taken-down ones', () => {
    const counted = LISTING_STATUSES.filter((status) => isCountedListing({ status }));
    expect(counted).toEqual(['active', 'paused', 'sold']);
  });

  it('counts only looks anyone can see now', () => {
    const counted = POST_STATUSES.filter((status) => isCountedPost({ status }));
    expect(counted).toEqual(['active']);
  });
});
