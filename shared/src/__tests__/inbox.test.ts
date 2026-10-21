import { describe, expect, it } from 'vitest';
import {
  inboxUnreadTotal,
  isHiddenFor,
  isMutedFor,
  isRequestFor,
  isWithBlocked,
  splitInbox,
  visibleAfterDelete,
} from '../inbox';

const ME = 'uid-ella';
const THEM = 'uid-maddie';
const at = (ms: number) => new Date(ms);

const thread = (over: Record<string, unknown> = {}) => ({
  id: 't',
  participantUids: [ME, THEM],
  bookingId: null,
  lastMessage: { body: 'hi', senderUid: THEM, sentAt: at(2000) },
  unreadCounts: { [ME]: 2, [THEM]: 0 },
  ...over,
});

describe('isHiddenFor', () => {
  it('is not hidden when she never deleted it', () => {
    expect(isHiddenFor(thread(), ME)).toBe(false);
  });

  it('stays hidden until something newer arrives', () => {
    expect(isHiddenFor(thread({ hiddenAt: { [ME]: at(3000) } }), ME)).toBe(true);
    expect(isHiddenFor(thread({ hiddenAt: { [ME]: at(1000) } }), ME)).toBe(false);
  });

  it('only hides it for the person who deleted it', () => {
    expect(isHiddenFor(thread({ hiddenAt: { [THEM]: at(3000) } }), ME)).toBe(false);
  });

  it('shows a message that is still on its way', () => {
    const sending = thread({
      hiddenAt: { [ME]: at(3000) },
      lastMessage: { body: 'hi', senderUid: THEM, sentAt: null },
    });
    expect(isHiddenFor(sending, ME)).toBe(false);
  });
});

describe('isMutedFor', () => {
  it('reads her own mute only', () => {
    expect(isMutedFor({ mutedUids: [ME] }, ME)).toBe(true);
    expect(isMutedFor({ mutedUids: [THEM] }, ME)).toBe(false);
    expect(isMutedFor({}, ME)).toBe(false);
  });
});

describe('isRequestFor', () => {
  const none = new Set<string>();

  it('is a request when a stranger wrote and she never answered', () => {
    expect(isRequestFor(thread({ repliedUids: [THEM] }), ME, none)).toBe(true);
  });

  it('is not a request once she follows them', () => {
    expect(isRequestFor(thread({ repliedUids: [THEM] }), ME, new Set([THEM]))).toBe(false);
  });

  it('is not a request once she has written back', () => {
    expect(isRequestFor(thread({ repliedUids: [THEM, ME] }), ME, none)).toBe(false);
  });

  it('is never a request for the person who started it', () => {
    expect(isRequestFor(thread({ repliedUids: [ME] }), ME, none)).toBe(false);
  });

  it('leaves old threads in the inbox', () => {
    expect(isRequestFor(thread(), ME, none)).toBe(false);
  });

  it('never treats a rental thread as a request', () => {
    expect(isRequestFor(thread({ repliedUids: [THEM], bookingId: 'b1' }), ME, none)).toBe(false);
  });

  it('is not a request when nobody has written', () => {
    expect(isRequestFor(thread({ repliedUids: [] }), ME, none)).toBe(false);
  });
});

describe('splitInbox and the badge', () => {
  const following = new Set<string>(['uid-friend']);
  const friend = thread({
    id: 'friend',
    participantUids: [ME, 'uid-friend'],
    repliedUids: ['uid-friend'],
  });
  const stranger = thread({ id: 'stranger', repliedUids: [THEM] });
  const deleted = thread({ id: 'deleted', hiddenAt: { [ME]: at(9000) } });
  const muted = thread({ id: 'muted', mutedUids: [ME] });

  it('sorts threads into inbox and requests, dropping deleted ones', () => {
    const { inbox, requests } = splitInbox([friend, stranger, deleted, muted], ME, following);
    expect(inbox.map((t) => t.id)).toEqual(['friend', 'muted']);
    expect(requests.map((t) => t.id)).toEqual(['stranger']);
  });

  it('counts only unmuted inbox threads toward the badge', () => {
    expect(inboxUnreadTotal([friend, stranger, deleted, muted], ME, following)).toBe(2);
  });

  it('drops threads with someone blocked either way, from inbox, requests and badge', () => {
    const blocked = new Set(['uid-friend', THEM]);
    const rental = thread({ id: 'rental', bookingId: 'b1' });
    const { inbox, requests } = splitInbox([friend, stranger, rental], ME, following, blocked);
    expect(inbox).toEqual([]);
    expect(requests).toEqual([]);
    expect(inboxUnreadTotal([friend, stranger, rental], ME, following, blocked)).toBe(0);
  });
});

describe('isWithBlocked', () => {
  it('is true only when the OTHER person is in the set', () => {
    expect(isWithBlocked(thread(), ME, new Set([THEM]))).toBe(true);
    expect(isWithBlocked(thread(), ME, new Set([ME]))).toBe(false);
    expect(isWithBlocked(thread(), ME, new Set())).toBe(false);
    expect(isWithBlocked(thread(), ME, new Set(['uid-someone-else']))).toBe(false);
  });
});

describe('visibleAfterDelete', () => {
  it('shows everything when she never deleted', () => {
    expect(visibleAfterDelete({}, ME, at(1))).toBe(true);
  });

  it('hides what came before her delete and shows what came after', () => {
    const t = { hiddenAt: { [ME]: at(2000) } };
    expect(visibleAfterDelete(t, ME, at(1500))).toBe(false);
    expect(visibleAfterDelete(t, ME, at(2500))).toBe(true);
    expect(visibleAfterDelete(t, ME, null)).toBe(true);
  });
});
