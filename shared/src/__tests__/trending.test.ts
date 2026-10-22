import { describe, expect, it } from 'vitest';
import { TRENDING, rankTrending, type TrendingListingInfo, type TrendingSignal } from '../trending';

function listings(...items: Partial<TrendingListingInfo>[]) {
  const map = new Map<string, TrendingListingInfo>();
  items.forEach((item, i) => {
    const id = item.id ?? `l${i}`;
    map.set(id, { id, ownerUid: 'owner', status: 'active', ...item });
  });
  return map;
}

const sig = (kind: TrendingSignal['kind'], uid: string, listingId: string): TrendingSignal => ({
  kind,
  uid,
  listingId,
});

describe('rankTrending', () => {
  it('ranks by weighted distinct people', () => {
    const map = listings({ id: 'a' }, { id: 'b' });
    const out = rankTrending(
      [
        sig('save', 'u1', 'a'),
        sig('save', 'u2', 'a'),
        sig('request', 'u1', 'b'),
        sig('request', 'u2', 'b'),
      ],
      map,
    );
    expect(out.map((i) => i.listingId)).toEqual(['b', 'a']);
    expect(out[0]).toEqual({ listingId: 'b', score: 2 * TRENDING.weights.request, people: 2 });
  });

  it('counts one person once per kind, however often she repeats it', () => {
    const map = listings({ id: 'a' });
    const spam = Array.from({ length: 50 }, () => sig('tap', 'u1', 'a'));
    const out = rankTrending([...spam, sig('tap', 'u2', 'a')], map);
    expect(out[0]?.score).toBe(2 * TRENDING.weights.tap);
  });

  it('needs at least minPeople different students', () => {
    const map = listings({ id: 'a' });
    const out = rankTrending(
      [sig('save', 'u1', 'a'), sig('tap', 'u1', 'a'), sig('request', 'u1', 'a')],
      map,
    );
    expect(out).toEqual([]);
  });

  it("ignores the owner's own actions on her piece", () => {
    const map = listings({ id: 'a', ownerUid: 'me' });
    const out = rankTrending([sig('save', 'me', 'a'), sig('save', 'u1', 'a')], map);
    expect(out).toEqual([]);
  });

  it('drops pieces that are not active or no longer exist', () => {
    const map = listings({ id: 'a', status: 'sold' }, { id: 'b', status: 'paused' });
    const out = rankTrending(
      [
        sig('save', 'u1', 'a'),
        sig('save', 'u2', 'a'),
        sig('save', 'u1', 'b'),
        sig('save', 'u2', 'b'),
        sig('save', 'u1', 'gone'),
        sig('save', 'u2', 'gone'),
      ],
      map,
    );
    expect(out).toEqual([]);
  });

  it('breaks ties by people, then id, and caps the size', () => {
    const map = listings({ id: 'c' }, { id: 'b' }, { id: 'a' });
    const signals = ['a', 'b', 'c'].flatMap((id) => [sig('save', 'u1', id), sig('save', 'u2', id)]);
    expect(rankTrending(signals, map).map((i) => i.listingId)).toEqual(['a', 'b', 'c']);
    expect(rankTrending(signals, map, 2)).toHaveLength(2);
  });
});
