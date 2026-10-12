import { describe, expect, it } from 'vitest';
import { timeAgo } from '../dates';

/**
 * `timeAgo` had no tests, and it is read on nearly every screen — the
 * feed, comments, chat, activity and the admin tables.
 *
 * The contract worth pinning is that EVERY rung reads the same way.
 * Minutes and hours used to abbreviate while days and up spelled it
 * out, so one list could show "25m" directly above "3 days ago".
 */

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const ago = (ms: number) => timeAgo(NOW - ms, NOW);

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('timeAgo', () => {
  it('says "just now" under a minute', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(59 * SECOND)).toBe('just now');
  });

  it('spells minutes out', () => {
    expect(ago(MINUTE)).toBe('1 minute ago');
    expect(ago(25 * MINUTE)).toBe('25 minutes ago');
    expect(ago(59 * MINUTE)).toBe('59 minutes ago');
  });

  it('spells hours out', () => {
    expect(ago(HOUR)).toBe('1 hour ago');
    expect(ago(2 * HOUR)).toBe('2 hours ago');
    expect(ago(23 * HOUR)).toBe('23 hours ago');
  });

  it('spells days, weeks, months and years out', () => {
    expect(ago(DAY)).toBe('1 day ago');
    expect(ago(3 * DAY)).toBe('3 days ago');
    expect(ago(7 * DAY)).toBe('1 week ago');
    expect(ago(21 * DAY)).toBe('3 weeks ago');
    expect(ago(60 * DAY)).toBe('2 months ago');
    expect(ago(400 * DAY)).toBe('1 year ago');
  });

  it('never abbreviates — every rung ends in "ago" or is "just now"', () => {
    // The actual bug: "25m" sitting above "3 days ago" in one list.
    const samples = [0, 30 * SECOND, MINUTE, 25 * MINUTE, HOUR, 5 * HOUR, DAY, 9 * DAY, 400 * DAY];
    for (const ms of samples) {
      const text = ago(ms);
      expect(text === 'just now' || text.endsWith(' ago')).toBe(true);
      expect(text).not.toMatch(/^\d+[mhdwy]$/);
    }
  });

  it('singularises exactly one of everything', () => {
    expect(ago(MINUTE)).not.toContain('minutes');
    expect(ago(HOUR)).not.toContain('hours');
    expect(ago(DAY)).not.toContain('days');
    expect(ago(7 * DAY)).not.toContain('weeks');
  });

  it('treats a future timestamp as "just now" rather than counting down', () => {
    // A few seconds of clock skew between her phone and the server put
    // brand new posts in the future.
    expect(timeAgo(NOW + 10 * SECOND, NOW)).toBe('just now');
  });

  it('returns an empty string for anything it cannot read', () => {
    // A missing timestamp should show nothing, never "NaN days ago".
    expect(timeAgo(null)).toBe('');
    expect(timeAgo(undefined)).toBe('');
    expect(timeAgo('not a date')).toBe('');
  });

  it('reads a Firestore-shaped timestamp', () => {
    expect(timeAgo({ seconds: (NOW - 3 * DAY) / 1000, nanoseconds: 0 }, NOW)).toBe('3 days ago');
  });
});
