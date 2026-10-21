import { describe, expect, it } from 'vitest';
import { needsMarkRead, receiptFor } from '../receipts';

const ME = 'uid-ella';
const THEM = 'uid-maddie';
const at = (ms: number) => new Date(ms);

const msg = (id: string, senderUid: string, ms: number | null) => ({
  id,
  senderUid,
  createdAt: ms == null ? (null as unknown as Date) : at(ms),
});

describe('receiptFor', () => {
  const thread = { unreadCounts: { [ME]: 0, [THEM]: 1 }, lastReadAt: {} };

  it('says Sent until she has opened the thread', () => {
    expect(receiptFor(thread, [msg('m2', ME, 2000)], ME)).toEqual({
      messageId: 'm2',
      label: 'Sent',
    });
  });

  it('says Seen once she opened it after it arrived', () => {
    const seen = { ...thread, lastReadAt: { [THEM]: at(2500) } };
    expect(receiptFor(seen, [msg('m2', ME, 2000)], ME)?.label).toBe('Seen');
  });

  it('does not count an open from before the message was sent', () => {
    const stale = { ...thread, lastReadAt: { [THEM]: at(1500) } };
    expect(receiptFor(stale, [msg('m2', ME, 2000)], ME)?.label).toBe('Sent');
  });

  it('ignores her own open time', () => {
    const mine = { ...thread, lastReadAt: { [ME]: at(9000) } };
    expect(receiptFor(mine, [msg('m2', ME, 2000)], ME)?.label).toBe('Sent');
  });

  it('shows nothing when the newest message is theirs', () => {
    expect(receiptFor(thread, [msg('m3', THEM, 3000), msg('m2', ME, 2000)], ME)).toBeNull();
  });

  it('shows nothing while the message is still sending', () => {
    expect(receiptFor(thread, [msg('m2', ME, null)], ME)).toBeNull();
  });

  it('copes with threads from before receipts existed', () => {
    expect(receiptFor({ unreadCounts: {} }, [msg('m2', ME, 2000)], ME)?.label).toBe('Sent');
    expect(receiptFor(null, [msg('m2', ME, 2000)], ME)).toBeNull();
    expect(receiptFor(thread, [], ME)).toBeNull();
  });
});

describe('needsMarkRead', () => {
  it('is true while her badge is up', () => {
    expect(needsMarkRead({ unreadCounts: { [ME]: 2 } }, [], ME)).toBe(true);
  });

  it('is true when they wrote after she last looked, even with no badge', () => {
    const thread = { unreadCounts: { [ME]: 0 }, lastReadAt: { [ME]: at(1000) } };
    expect(needsMarkRead(thread, [msg('m2', THEM, 2000)], ME)).toBe(true);
  });

  it('is false once she has looked since their last message', () => {
    const thread = { unreadCounts: { [ME]: 0 }, lastReadAt: { [ME]: at(3000) } };
    expect(needsMarkRead(thread, [msg('m3', ME, 4000), msg('m2', THEM, 2000)], ME)).toBe(false);
  });

  it('is true for an older thread she has never opened since receipts arrived', () => {
    expect(needsMarkRead({ unreadCounts: { [ME]: 0 } }, [msg('m2', THEM, 2000)], ME)).toBe(true);
  });

  it('is false when only she has spoken', () => {
    expect(needsMarkRead({ unreadCounts: { [ME]: 0 } }, [msg('m2', ME, 2000)], ME)).toBe(false);
  });
});
