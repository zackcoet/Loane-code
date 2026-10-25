/**
 * What a lender's blocked-dates list becomes. Pure — no emulator needed.
 */
import { describe, expect, it } from 'vitest';
import { planBlockedDates } from '../bookings/blockedDates';

const TODAY = '2026-10-25';

describe('planBlockedDates', () => {
  it('sorts and de-duplicates', () => {
    expect(
      planBlockedDates({
        requested: ['2026-11-08', '2026-11-07', '2026-11-08'],
        existing: [],
        booked: [],
        today: TODAY,
      }),
    ).toEqual({ ok: true, blocked: ['2026-11-07', '2026-11-08'] });
  });

  it('drops days before yesterday, keeps yesterday and today', () => {
    expect(
      planBlockedDates({
        requested: ['2026-10-01', '2026-10-23', '2026-10-24', '2026-10-25'],
        existing: [],
        booked: [],
        today: TODAY,
      }),
    ).toEqual({ ok: true, blocked: ['2026-10-24', '2026-10-25'] });
  });

  it('refuses a newly blocked day that a confirmed rental already has', () => {
    expect(
      planBlockedDates({
        requested: ['2026-11-07'],
        existing: [],
        booked: [{ startDate: '2026-11-06', endDate: '2026-11-09' }],
        today: TODAY,
      }),
    ).toEqual({ ok: false, clash: '2026-11-07' });
  });

  it('allows the return day — ranges are half-open', () => {
    expect(
      planBlockedDates({
        requested: ['2026-11-09'],
        existing: [],
        booked: [{ startDate: '2026-11-06', endDate: '2026-11-09' }],
        today: TODAY,
      }),
    ).toEqual({ ok: true, blocked: ['2026-11-09'] });
  });

  it('does not trap her when a day she already blocked later got booked', () => {
    // She accepted a request made before she blocked the day. The phone
    // won't let her unblock a booked day, so the server drops it instead
    // of refusing every save from then on.
    expect(
      planBlockedDates({
        requested: ['2026-11-07', '2026-11-20'],
        existing: ['2026-11-07'],
        booked: [{ startDate: '2026-11-07', endDate: '2026-11-08' }],
        today: TODAY,
      }),
    ).toEqual({ ok: true, blocked: ['2026-11-20'] });
  });

  it('ignores bookings with missing or backwards dates', () => {
    expect(
      planBlockedDates({
        requested: ['2026-11-07'],
        existing: [],
        booked: [
          { startDate: null, endDate: null },
          { startDate: '2026-11-08', endDate: '2026-11-01' },
        ],
        today: TODAY,
      }),
    ).toEqual({ ok: true, blocked: ['2026-11-07'] });
  });
});
