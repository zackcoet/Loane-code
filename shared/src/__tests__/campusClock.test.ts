import { afterEach, describe, expect, it, vi } from 'vitest';
import { campusClock, campusToday } from '../dates';

// 9 PM in Columbia on Fri Oct 30 2026 (EDT, UTC−4) is 01:00 UTC on the 31st.
const NINE_PM_OCT_30 = Date.UTC(2026, 9, 31, 1, 0);

describe('campusToday', () => {
  afterEach(() => vi.restoreAllMocks());

  it("stays on Columbia's day after 8 PM, when world time has rolled over", () => {
    expect(new Date(NINE_PM_OCT_30).toISOString().slice(0, 10)).toBe('2026-10-31');
    expect(campusToday(NINE_PM_OCT_30)).toBe('2026-10-30');
  });

  it('turns over at midnight in Columbia', () => {
    expect(campusToday(Date.UTC(2026, 9, 31, 3, 59))).toBe('2026-10-30');
    expect(campusToday(Date.UTC(2026, 9, 31, 4, 0))).toBe('2026-10-31');
  });

  it('follows standard time in winter (UTC−5)', () => {
    expect(campusToday(Date.UTC(2026, 11, 5, 4, 59))).toBe('2026-12-04');
    expect(campusToday(Date.UTC(2026, 11, 5, 5, 0))).toBe('2026-12-05');
  });

  it('works the same by hand when the phone has no time-zone support', () => {
    // Every hour across two years, including both clock changes.
    const start = Date.UTC(2026, 0, 1);
    const expected: Array<{ today: string; hour: number }> = [];
    const moments: number[] = [];
    for (let h = 0; h < 24 * 365 * 2; h += 1) {
      const ms = start + h * 3_600_000 + 30 * 60_000;
      moments.push(ms);
      expected.push(campusClock(ms));
    }
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl');
    });
    moments.forEach((ms, i) => expect(campusClock(ms)).toEqual(expected[i]));
  });
});
