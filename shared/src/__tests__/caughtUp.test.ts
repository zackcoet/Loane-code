import { describe, expect, it } from 'vitest';
import { caughtUpIndex } from '../feedOrder';
import { FEED_RANKING } from '../feedRanking';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 22, 12);
const at = (hoursAgo: number | null) => ({
  created: hoursAgo === null ? null : NOW - hoursAgo * HOUR,
});
const created = (p: { created: number | null }) => p.created;

describe('caughtUpIndex', () => {
  it('marks the first look older than the window', () => {
    const posts = [at(1), at(20), at(71), at(73), at(100)];
    expect(caughtUpIndex(posts, created, NOW)).toBe(3);
  });

  it('uses the configured window', () => {
    expect(FEED_RANKING.caughtUp.windowHours).toBe(72);
    expect(caughtUpIndex([at(1), at(5)], created, NOW, 4)).toBe(1);
  });

  it('shows nothing when every look is new', () => {
    expect(caughtUpIndex([at(1), at(2)], created, NOW)).toBe(-1);
  });

  it('shows nothing when every look is old', () => {
    expect(caughtUpIndex([at(80), at(90)], created, NOW)).toBe(-1);
  });

  it('shows nothing for an empty list', () => {
    expect(caughtUpIndex([], created, NOW)).toBe(-1);
  });

  it('treats a look still waiting for its server time as new', () => {
    expect(caughtUpIndex([at(null), at(80)], created, NOW)).toBe(1);
  });
});
