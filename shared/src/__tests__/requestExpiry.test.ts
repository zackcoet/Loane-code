/**
 * When an unanswered rental request expires.
 *
 * Pure — no emulator needed.
 */

import { describe, expect, it } from 'vitest';
import { hoursToAnswer, requestExpiry } from '../requestExpiry';

const HOUR = 3_600_000;
// 3 PM in Columbia on Thu Oct 29 2026 (EDT, UTC−4).
const THU_3PM = Date.UTC(2026, 9, 29, 19, 0);
// Midnight starting Sat Oct 31 in Columbia.
const SAT_MIDNIGHT = Date.UTC(2026, 9, 31, 4, 0);

describe('requestExpiry', () => {
  it('gives the lender 24 hours when the rental is days away', () => {
    expect(requestExpiry('2026-11-05', false, THU_3PM).getTime()).toBe(THU_3PM + 24 * HOUR);
  });

  it('never runs past midnight on campus as the rental day begins', () => {
    // Friday 10 AM, for Saturday: 14 hours, not 24.
    const fri10am = Date.UTC(2026, 9, 30, 14, 0);
    expect(requestExpiry('2026-10-31', false, fri10am).getTime()).toBe(SAT_MIDNIGHT);
  });

  it('a request for tomorrow is not already expired when it is made', () => {
    // The old rule put this at midnight world time on Thursday — in the past.
    const expiry = requestExpiry('2026-10-30', false, THU_3PM).getTime();
    expect(expiry).toBeGreaterThan(THU_3PM);
    expect(expiry).toBe(Date.UTC(2026, 9, 30, 4, 0)); // midnight Thu→Fri in Columbia
  });

  it('a late-night request for tomorrow still gets the same-day window', () => {
    const thu11pm = Date.UTC(2026, 9, 30, 3, 0);
    expect(requestExpiry('2026-10-30', false, thu11pm).getTime()).toBe(thu11pm + 2 * HOUR);
  });

  it('a same-day request gets two hours, not instant expiry', () => {
    expect(requestExpiry('2026-10-29', true, THU_3PM).getTime()).toBe(THU_3PM + 2 * HOUR);
  });

  it('uses Columbia midnight in winter too (UTC−5)', () => {
    const monNoon = Date.UTC(2026, 11, 7, 17, 0);
    expect(requestExpiry('2026-12-08', false, monNoon).getTime()).toBe(Date.UTC(2026, 11, 8, 5, 0));
  });
});

describe('hoursToAnswer', () => {
  it('says the window in whole hours', () => {
    expect(hoursToAnswer(24 * HOUR)).toBe('24 hours');
    expect(hoursToAnswer(9 * HOUR + 10 * 60_000)).toBe('9 hours');
    expect(hoursToAnswer(40 * 60_000)).toBe('1 hour');
  });
});
