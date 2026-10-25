/**
 * Rental reminders — which ones are due, on whose "today", and when.
 *
 * Pure logic, no database. The sweep's own test (sweep.test.ts) proves
 * each one goes out once against the emulator.
 */

import { describe, expect, it } from 'vitest';
import { campusClock, type Booking } from '@loane/shared';
import { isReminderHour, remindersDue } from '../bookings/reminders';

const TODAY = '2026-11-06';

function rental(fields: Partial<Booking> & { remindersSent?: Record<string, boolean> }) {
  return {
    id: 'b1',
    kind: 'rental',
    status: 'confirmed',
    lenderUid: 'uid-ella',
    renterUid: 'uid-harper',
    lender: { uid: 'uid-ella', username: 'ella', displayName: 'Ella' },
    renter: { uid: 'uid-harper', username: 'harper', displayName: 'Harper' },
    listing: { name: 'Red gameday dress' },
    startDate: '2026-11-20',
    endDate: '2026-11-23',
    ...fields,
  } as unknown as Booking & { remindersSent?: Record<string, boolean> };
}

const titles = (b: ReturnType<typeof rental>) => remindersDue(b, TODAY).map((r) => r.title);

describe('the campus clock', () => {
  it('is still today in Columbia after 8 PM, when the server has moved on', () => {
    // 01:30 UTC on Nov 7 is 8:30 PM on Nov 6 in Columbia (EST).
    const at = Date.UTC(2026, 10, 7, 1, 30);
    expect(new Date(at).toISOString().slice(0, 10)).toBe('2026-11-07');
    expect(campusClock(at)).toEqual({ today: '2026-11-06', hour: 20 });
  });

  it('follows daylight saving time', () => {
    // Summer: 8 AM in Columbia is 12:00 UTC (EDT, four hours behind).
    expect(campusClock(Date.UTC(2026, 6, 4, 12, 0))).toEqual({ today: '2026-07-04', hour: 8 });
    // Winter: 8 AM in Columbia is 13:00 UTC (EST, five hours behind).
    expect(campusClock(Date.UTC(2026, 11, 4, 13, 0))).toEqual({ today: '2026-12-04', hour: 8 });
  });

  it('reads midnight as hour 0, not 24', () => {
    expect(campusClock(Date.UTC(2026, 11, 4, 5, 0)).hour).toBe(0);
  });
});

describe('quiet hours', () => {
  it('sends from 8 AM, and nothing from 9 PM until morning', () => {
    expect([0, 3, 7].map(isReminderHour)).toEqual([false, false, false]);
    expect([8, 12, 20].map(isReminderHour)).toEqual([true, true, true]);
    expect([21, 23].map(isReminderHour)).toEqual([false, false]);
  });
});

describe('which reminders are due', () => {
  it('starts tomorrow: both girls', () => {
    const due = remindersDue(rental({ startDate: '2026-11-07' }), TODAY);
    expect(due.map((d) => [d.uid, d.title])).toEqual([
      ['uid-harper', 'Your rental starts tomorrow'],
      ['uid-ella', 'You are lending tomorrow'],
    ]);
  });

  it('hand-over day: drop off and pick up', () => {
    expect(titles(rental({ startDate: TODAY }))).toEqual(['Drop off today', 'Pick up today']);
  });

  it('due back tomorrow, today, and overdue — to the right people', () => {
    expect(titles(rental({ status: 'with_renter', endDate: '2026-11-07' }))).toEqual([
      'Due back tomorrow',
    ]);
    expect(titles(rental({ status: 'with_renter', endDate: TODAY }))).toEqual(['Due back today']);
    const late = remindersDue(rental({ status: 'with_renter', endDate: '2026-11-04' }), TODAY);
    expect(late.map((d) => d.uid)).toEqual(['uid-harper', 'uid-ella']);
  });

  it('says an overdue date the way a person would', () => {
    const [late] = remindersDue(rental({ status: 'with_renter', endDate: '2026-11-04' }), TODAY);
    expect(late!.body).toContain('Wed, Nov 4');
    expect(late!.body).not.toContain('2026-11-04');
  });

  it('never repeats one already sent', () => {
    const b = rental({ startDate: TODAY, remindersSent: { dropoffToday: true } });
    expect(remindersDue(b, TODAY)).toEqual([]);
  });

  it('nothing once it is back, finished, or never went ahead', () => {
    for (const status of ['returned', 'completed', 'cancelled', 'declined', 'requested'] as const) {
      expect(remindersDue(rental({ status, startDate: TODAY, endDate: TODAY }), TODAY)).toEqual([]);
    }
  });

  it('nothing for a sale — it has no dates and nothing comes back', () => {
    const sale = rental({
      kind: 'purchase',
      status: 'with_renter',
      startDate: null,
      endDate: null,
    });
    expect(remindersDue(sale, TODAY)).toEqual([]);
  });
});
