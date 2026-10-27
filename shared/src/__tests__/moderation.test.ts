import { describe, expect, it } from 'vitest';
import {
  listingFieldsOnSale,
  reportPersonLabel,
  reportsAboutUser,
  statusAfterRestore,
  suspendBlockedReason,
  takedownBlockedReason,
} from '../moderation';

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

describe('a sale finishing', () => {
  it('marks a live piece sold', () => {
    expect(listingFieldsOnSale('active')).toEqual({ status: 'sold' });
    expect(listingFieldsOnSale('paused')).toEqual({ status: 'sold' });
    expect(listingFieldsOnSale(undefined)).toEqual({ status: 'sold' });
  });

  it('keeps a taken-down piece down, remembering it as sold', () => {
    expect(listingFieldsOnSale('suspended')).toEqual({ statusBeforeSuspension: 'sold' });
    expect(statusAfterRestore('listing', 'sold')).toBe('sold');
  });
});

describe('who a report is about, in the dashboard', () => {
  const users = [
    { uid: 'ella', username: 'ella_new', status: 'active' },
    { uid: 'kat', username: 'kat', status: 'suspended' },
    { uid: 'gone', username: 'deleted_gone', status: 'deactivated', deletedAt: 123 },
  ];

  it('shows her current @username, looked up by account id, so a rename never shows a stale name', () => {
    expect(reportPersonLabel('ella', users)).toEqual({ label: '@ella_new', openUid: 'ella' });
  });

  it('says when she is already suspended', () => {
    expect(reportPersonLabel('kat', users).label).toBe('@kat (suspended)');
  });

  it('says "Deleted account" for a deleted girl, never her old handle', () => {
    expect(reportPersonLabel('gone', users)).toEqual({ label: 'Deleted account', openUid: 'gone' });
  });

  it('cannot open someone the dashboard has not loaded', () => {
    const label = reportPersonLabel('someone-else-123', users);
    expect(label.openUid).toBeNull();
    expect(label.label).toMatch(/not loaded/);
  });

  it('names the automatic filter and copes with no one', () => {
    expect(reportPersonLabel('__filter', users, '__filter')).toEqual({
      label: 'Automatic filter',
      openUid: null,
    });
    expect(reportPersonLabel(null, users)).toEqual({ label: 'Nobody named', openUid: null });
  });

  it('lists only reports about her, open ones first', () => {
    const reports = [
      { id: 'a', targetUid: 'ella', status: 'dismissed' },
      { id: 'b', targetUid: 'kat', status: 'open' },
      { id: 'c', targetUid: 'ella', status: 'open' },
      { id: 'd', targetUid: 'ella', status: 'actioned' },
    ];
    expect(reportsAboutUser(reports, 'ella').map((r) => r.id)).toEqual(['c', 'a', 'd']);
  });
});
