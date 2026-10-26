/**
 * The shape of "Download my data", without the emulator: dates read as
 * dates, and our private notes on her reports stay out.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { ownSideOfConversation, toPlain, withoutAdminNotes } from '../privacy/exportUserData';

describe('ownSideOfConversation', () => {
  const convo = {
    participantUids: ['ella', 'harper'],
    unreadCounts: { ella: 3, harper: 0 },
    lastReadAt: { ella: '2026-10-20T00:00:00.000Z', harper: '2026-10-21T00:00:00.000Z' },
    hiddenAt: { harper: '2026-10-22T00:00:00.000Z' },
    mutedUids: ['ella', 'harper'],
    lastMessage: { body: 'see you sat', senderUid: 'harper' },
  };

  it('keeps her own side and drops the other girl’s', () => {
    expect(ownSideOfConversation(convo, 'ella')).toEqual({
      participantUids: ['ella', 'harper'],
      unreadCounts: { ella: 3 },
      lastReadAt: { ella: '2026-10-20T00:00:00.000Z' },
      hiddenAt: {},
      mutedUids: ['ella'],
      lastMessage: { body: 'see you sat', senderUid: 'harper' },
    });
  });

  it('works the same from the other side', () => {
    const harper = ownSideOfConversation(convo, 'harper');
    expect(harper.unreadCounts).toEqual({ harper: 0 });
    expect(harper.hiddenAt).toEqual({ harper: '2026-10-22T00:00:00.000Z' });
    expect(harper.mutedUids).toEqual(['harper']);
  });

  it('leaves older chats without these fields alone', () => {
    expect(ownSideOfConversation({ participantUids: ['ella', 'harper'] }, 'ella')).toEqual({
      participantUids: ['ella', 'harper'],
    });
  });

  it('does not change the chat it was given', () => {
    const copy = JSON.parse(JSON.stringify(convo));
    ownSideOfConversation(convo, 'ella');
    expect(convo).toEqual(copy);
  });
});

describe('toPlain', () => {
  it('turns timestamps into readable dates, however deep', () => {
    const at = Timestamp.fromDate(new Date('2026-10-04T15:00:00.000Z'));
    expect(toPlain({ createdAt: at, nested: { list: [at] } })).toEqual({
      createdAt: '2026-10-04T15:00:00.000Z',
      nested: { list: ['2026-10-04T15:00:00.000Z'] },
    });
  });

  it('leaves plain values alone', () => {
    expect(toPlain({ a: 1, b: 'x', c: null, d: true })).toEqual({ a: 1, b: 'x', c: null, d: true });
  });
});

describe('withoutAdminNotes', () => {
  it('keeps what was done and drops who did it and their notes', () => {
    const report = {
      id: 'r1',
      reason: 'harassment',
      resolution: {
        adminUid: 'uid-admin',
        action: 'user_warned',
        notes: 'second time this week',
        resolvedAt: '2026-10-20T00:00:00.000Z',
      },
    };
    expect(withoutAdminNotes(report)).toEqual({
      id: 'r1',
      reason: 'harassment',
      resolution: { action: 'user_warned', resolvedAt: '2026-10-20T00:00:00.000Z' },
    });
  });

  it('copes with a report that has no resolution yet', () => {
    expect(withoutAdminNotes({ id: 'r2', resolution: null })).toEqual({
      id: 'r2',
      resolution: null,
    });
  });
});
