import { describe, expect, it } from 'vitest';
import { IMPRESSION, ImpressionTracker } from '../impressions';

const on = (...ids: string[]) => ids.map((postId, position) => ({ postId, position }));

describe('ImpressionTracker', () => {
  it('reports a post once it leaves the screen, with how long it was there', () => {
    const t = new ImpressionTracker();
    expect(t.update(on('a', 'b'), 0)).toEqual([]);
    expect(t.update(on('b'), 2_000)).toEqual([{ postId: 'a', dwellMs: 2_000, position: 0 }]);
  });

  it('ignores a flick, and still counts a real look later', () => {
    const t = new ImpressionTracker();
    t.update(on('a'), 0);
    expect(t.update([], IMPRESSION.minDwellMs - 1)).toEqual([]);
    t.update(on('a'), 10_000);
    expect(t.update([], 13_000)).toEqual([{ postId: 'a', dwellMs: 3_000, position: 0 }]);
  });

  it('reports each post only once per session', () => {
    const t = new ImpressionTracker();
    t.update(on('a'), 0);
    expect(t.update([], 1_000)).toHaveLength(1);
    t.update(on('a'), 2_000);
    expect(t.update([], 9_000)).toEqual([]);
  });

  it('caps a phone left open on one post', () => {
    const t = new ImpressionTracker();
    t.update(on('a'), 0);
    expect(t.update([], 10 * 60_000)[0]?.dwellMs).toBe(IMPRESSION.maxDwellMs);
  });

  it('flush ends everything on screen when she leaves', () => {
    const t = new ImpressionTracker();
    t.update(on('a', 'b'), 0);
    const done = t.flush(1_500);
    expect(done.map((d) => d.postId).sort()).toEqual(['a', 'b']);
    expect(t.flush(5_000)).toEqual([]);
  });

  it('keeps the position where she first saw it', () => {
    const t = new ImpressionTracker();
    t.update([{ postId: 'x', position: 7 }], 0);
    expect(t.flush(1_000)[0]?.position).toBe(7);
  });
});
