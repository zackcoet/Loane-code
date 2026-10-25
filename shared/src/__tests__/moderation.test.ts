import { describe, expect, it } from 'vitest';
import { statusAfterRestore, suspendBlockedReason, takedownBlockedReason } from '../moderation';

describe('taking content down', () => {
  it('is allowed for anything still showing, sold pieces included', () => {
    for (const s of ['active', 'paused', 'draft', 'sold', 'scheduled']) {
      expect(takedownBlockedReason(s)).toBeNull();
    }
  });

  it('is refused when it is already down or its owner removed it', () => {
    expect(takedownBlockedReason('suspended')).toMatch(/already down/);
    expect(takedownBlockedReason('removed')).toMatch(/owner already removed/);
  });
});

describe('putting content back', () => {
  it('returns a listing to what it was — a sold piece stays sold', () => {
    expect(statusAfterRestore('listing', 'sold')).toBe('sold');
    expect(statusAfterRestore('listing', 'paused')).toBe('paused');
    expect(statusAfterRestore('listing', 'draft')).toBe('draft');
    expect(statusAfterRestore('listing', 'active')).toBe('active');
  });

  it('returns a look to what it was', () => {
    expect(statusAfterRestore('post', 'scheduled')).toBe('scheduled');
    expect(statusAfterRestore('post', 'active')).toBe('active');
  });

  it('never brings back something removed, and falls back to active for old or odd values', () => {
    expect(statusAfterRestore('listing', 'removed')).toBe('active');
    expect(statusAfterRestore('listing', 'suspended')).toBe('active');
    expect(statusAfterRestore('post', 'removed')).toBe('active');
    expect(statusAfterRestore('post', 'sold')).toBe('active');
    expect(statusAfterRestore('listing', undefined)).toBe('active');
    expect(statusAfterRestore('listing', null)).toBe('active');
    expect(statusAfterRestore('listing', 42)).toBe('active');
  });
});

describe('suspending an account', () => {
  it('is allowed for an active account', () => {
    expect(suspendBlockedReason('active')).toBeNull();
  });

  it('is refused when she is already suspended or the account is deleted', () => {
    expect(suspendBlockedReason('suspended')).toMatch(/already suspended/);
    expect(suspendBlockedReason('deactivated')).toMatch(/deleted/);
  });
});
