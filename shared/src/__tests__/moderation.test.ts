import { describe, expect, it } from 'vitest';
import {
  adminActionLabel,
  adminActionsAboutUser,
  adminTargetLabel,
  foundingClosetBlockedReason,
  grantBlockedReason,
  listingFieldsOnSale,
  moderationButtonBlockedReason,
  myReportStatusLabel,
  ownerRestoreBlockedReason,
  personLabelWithCopy,
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

describe('who a Contact us message is from, in the dashboard', () => {
  const users = [
    { uid: 'ella', username: 'ella_new', status: 'active' },
    { uid: 'gone', username: 'deleted_gone', status: 'deactivated', deletedAt: 123 },
  ];

  it('prefers her live account over the copy the message kept', () => {
    expect(personLabelWithCopy('ella', users, { username: 'ella_old' })).toEqual({
      label: '@ella_new',
      openUid: 'ella',
    });
    expect(personLabelWithCopy('gone', users, { username: 'ella_old' }).label).toBe(
      'Deleted account',
    );
  });

  it('falls back to the copy, marked as sent, when her account is not loaded', () => {
    expect(personLabelWithCopy('far-away', users, { username: 'maya' })).toEqual({
      label: '@maya (as sent)',
      openUid: null,
    });
  });

  it('never shows a deleted copy as a handle', () => {
    expect(personLabelWithCopy('far-away', users, { username: 'deleted_far-away' }).label).toBe(
      'Deleted account',
    );
  });

  it('copes with no copy at all', () => {
    expect(personLabelWithCopy('far-away', users, null).label).toMatch(/not loaded/);
  });
});

describe('the Activity Log in plain words', () => {
  it('names every action the server writes', () => {
    expect(adminActionLabel('suspend_user')).toBe('Suspended her account');
    expect(adminActionLabel('report_dismissed')).toBe('Dismissed a report');
    expect(adminActionLabel('hide_post')).toBe('Took a look down');
    expect(adminActionLabel('restore_listing')).toBe('Put a piece back');
    expect(adminActionLabel('resolve_support_request')).toBe('Closed a Contact us message');
  });

  it('still shows an action it has not been taught, never hides the row', () => {
    expect(adminActionLabel('freeze_campus')).toBe('Freeze campus');
    expect(adminActionLabel('')).toBe('Unknown action');
  });

  it('says what was acted on with a short id', () => {
    expect(adminTargetLabel('post', 'abcdefghijklmnop')).toBe('Look · abcdefgh…');
    expect(adminTargetLabel('message', 'conv123/msg45')).toBe('Message · msg45');
    expect(adminTargetLabel('config', 'features')).toBe('Feature switches');
    expect(adminTargetLabel('legalDoc', 'terms-v2')).toBe('Terms / Privacy · terms-v2');
    expect(adminTargetLabel('somethingNew', 'x1')).toBe('somethingNew · x1');
  });

  it('lists only the actions on one student, newest first', () => {
    const rows = [
      { id: 'a', targetType: 'user', targetId: 'u1', t: 1 },
      { id: 'b', targetType: 'report', targetId: 'u1', t: 5 },
      { id: 'c', targetType: 'user', targetId: 'u2', t: 3 },
      { id: 'd', targetType: 'user', targetId: 'u1', t: 9 },
    ];
    expect(adminActionsAboutUser(rows, 'u1', (r) => r.t).map((r) => r.id)).toEqual(['d', 'a']);
  });
});

describe('the status she sees on her own reports', () => {
  it('never tells her a report was "dismissed"', () => {
    expect(myReportStatusLabel('open')).toBe('Sent');
    expect(myReportStatusLabel('reviewing')).toBe('Being looked at');
    expect(myReportStatusLabel('actioned')).toBe('Handled');
    expect(myReportStatusLabel('dismissed')).toBe('Closed');
    expect(myReportStatusLabel('resolved')).toBe('Closed');
    expect(myReportStatusLabel('something_new')).toBe('Sent');
  });
});

describe("a deleted girl's things stay down", () => {
  it('refuses to put back anything of a deleted or missing account', () => {
    expect(ownerRestoreBlockedReason({ status: 'deactivated' })).toMatch(/deleted/);
    expect(ownerRestoreBlockedReason(null)).toMatch(/deleted/);
    expect(ownerRestoreBlockedReason({ status: 'active' })).toBeNull();
    expect(ownerRestoreBlockedReason({ status: 'suspended' })).toBeNull();
  });

  it('greys out the dashboard button only when the server would refuse', () => {
    const deleted = { status: 'deactivated' };
    expect(moderationButtonBlockedReason('removed', { status: 'active' })).toMatch(/removed/);
    expect(moderationButtonBlockedReason('suspended', deleted)).toMatch(/deleted/);
    expect(moderationButtonBlockedReason('suspended', { status: 'active' })).toBeNull();
    // Not loaded in the dashboard: let the server decide.
    expect(moderationButtonBlockedReason('suspended', undefined)).toBeNull();
    // Taking down a live piece of hers is never blocked by her status.
    expect(moderationButtonBlockedReason('active', deleted)).toBeNull();
  });

  it('gives no free try-ons to a deleted account', () => {
    expect(grantBlockedReason('deactivated')).toMatch(/deleted/);
    expect(grantBlockedReason('active')).toBeNull();
    expect(grantBlockedReason('suspended')).toBeNull();
  });
});

describe('marking a Founding Closet', () => {
  const girl = { status: 'active', role: 'student', isFoundingCloset: false };

  it('is allowed for an ordinary student, and for a suspended one', () => {
    expect(foundingClosetBlockedReason(girl, true)).toBeNull();
    expect(foundingClosetBlockedReason({ ...girl, status: 'suspended' }, true)).toBeNull();
  });

  it('is refused for a deleted account, an admin, or one already marked', () => {
    expect(foundingClosetBlockedReason({ ...girl, status: 'deactivated' }, true)).toMatch(
      /deleted/,
    );
    expect(foundingClosetBlockedReason({ ...girl, role: 'admin' }, true)).toMatch(/Admin/);
    expect(foundingClosetBlockedReason({ ...girl, isFoundingCloset: true }, true)).toMatch(
      /already/,
    );
  });

  it('can always take a marked girl off, never one who is not on', () => {
    expect(
      foundingClosetBlockedReason(
        { ...girl, status: 'deactivated', isFoundingCloset: true },
        false,
      ),
    ).toBeNull();
    expect(foundingClosetBlockedReason(girl, false)).toMatch(/not a Founding Closet/);
  });

  it('reads in words in the audit log', () => {
    expect(adminActionLabel('founding_closet_marked')).toBe('Made her a Founding Closet');
  });
});
