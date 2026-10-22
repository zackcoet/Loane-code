/**
 * The shape of "Download my data", without the emulator: dates read as
 * dates, and our private notes on her reports stay out.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { toPlain, withoutAdminNotes } from '../privacy/exportUserData';

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
