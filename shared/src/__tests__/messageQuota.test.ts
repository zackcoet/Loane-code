import { describe, expect, it } from 'vitest';
import { otherQuotaWrite, quotaWrite } from '../messageQuota';

const HOUR = 3_600_000;

describe('quotaWrite', () => {
  it('starts a window when there is no counter yet', () => {
    expect(quotaWrite(null, 1_000)).toBe('start');
  });

  it('adds to a window that is still open', () => {
    expect(quotaWrite({ windowStart: new Date(0), count: 10 }, HOUR - 1)).toBe('bump');
  });

  it('waits a little past the hour before starting fresh', () => {
    // A fast phone clock must not ask the server to reset early.
    expect(quotaWrite({ windowStart: new Date(0), count: 10 }, HOUR + 60_000)).toBe('bump');
    expect(quotaWrite({ windowStart: new Date(0), count: 10 }, HOUR + 3 * 60_000)).toBe('start');
  });

  it('uses the window length it is given (listings share the helper)', () => {
    const half = HOUR / 2;
    expect(quotaWrite({ windowStart: new Date(0), count: 3 }, half + 3 * 60_000, half)).toBe(
      'start',
    );
    expect(quotaWrite({ windowStart: new Date(0), count: 3 }, half - 1, half)).toBe('bump');
  });

  it('treats a window still waiting for its server time as open', () => {
    expect(quotaWrite({ windowStart: null, count: 1 }, 5 * HOUR)).toBe('bump');
  });

  it('offers the other write for one retry', () => {
    expect(otherQuotaWrite('start')).toBe('bump');
    expect(otherQuotaWrite('bump')).toBe('start');
  });
});
