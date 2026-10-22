import { describe, expect, it } from 'vitest';
import type { Occasion } from '../constants';
import {
  FEED_RANKING,
  availablePart,
  buildOccasionAffinity,
  explainScore,
  freshPart,
  isListingAvailableSoon,
  qualityPart,
  rankPosts,
  whatPart,
  whoPart,
  type RankingViewer,
} from '../feedRanking';
import type { Listing } from '../types/listing';
import type { Post } from '../types/post';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 22, 12);
const TODAY = '2026-10-22';

function viewer(over: Partial<RankingViewer> = {}): RankingViewer {
  return {
    uid: 'me',
    following: new Set(),
    followers: new Set(),
    interactions: new Map(),
    occasionAffinity: new Map(),
    ...over,
  };
}

function stats(over: Partial<Post['stats']> = {}): Post['stats'] {
  return {
    likeCount: 0,
    saveCount: 0,
    viewCount: 0,
    tagTapCount: 0,
    commentCount: 0,
    shareCount: 0,
    ...over,
  };
}

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    status: 'active',
    intent: 'rent',
    salePriceCents: null,
    bookedDates: [],
    blackoutDates: [],
    ...over,
  } as Listing;
}

function post(id: string, over: Partial<Post> = {}) {
  return {
    id,
    authorUid: 'someone',
    occasions: [] as Occasion[],
    stats: stats(),
    taggedListingIds: [] as string[],
    ...over,
  };
}

describe('whoPart', () => {
  it('is zero for strangers and for her own looks', () => {
    expect(whoPart('stranger', viewer())).toBe(0);
    expect(whoPart('me', viewer({ following: new Set(['me']) }))).toBe(0);
  });

  it('ranks mutuals above one-way follows', () => {
    const v = viewer({ following: new Set(['a', 'b']), followers: new Set(['b']) });
    expect(whoPart('b', v)).toBeGreaterThan(whoPart('a', v));
  });

  it('caps how much past interaction can add', () => {
    const v = viewer({ interactions: new Map([['a', 1_000]]) });
    expect(whoPart('a', v)).toBe(FEED_RANKING.who.interactionMax);
  });
});

describe('whatPart', () => {
  it('scores her favourite occasion 1 and others relative to it', () => {
    const v = viewer({
      occasionAffinity: new Map<Occasion, number>([
        ['gameday', 10],
        ['formal', 5],
      ]),
    });
    expect(whatPart(['gameday'], v)).toBe(1);
    expect(whatPart(['formal'], v)).toBe(0.5);
    expect(whatPart(['wedding'], v)).toBe(0);
  });

  it('is zero when she has no history yet', () => {
    expect(whatPart(['gameday'], viewer())).toBe(0);
  });
});

describe('freshPart', () => {
  it('halves every half-life', () => {
    expect(freshPart(NOW, NOW)).toBe(1);
    const h = FEED_RANKING.freshHalfLifeHours;
    expect(freshPart(NOW - h * HOUR, NOW)).toBeCloseTo(0.5);
    expect(freshPart(NOW - 2 * h * HOUR, NOW)).toBeCloseTo(0.25);
  });

  it('treats a clock a little ahead as brand new, and a missing date as stale', () => {
    expect(freshPart(NOW + HOUR, NOW)).toBe(1);
    expect(freshPart(null, NOW)).toBe(0);
  });
});

describe('qualityPart', () => {
  it('rewards rate, not raw likes', () => {
    const small = qualityPart(stats({ viewCount: 6, likeCount: 4 }));
    const big = qualityPart(stats({ viewCount: 570, likeCount: 30 }));
    expect(small).toBeGreaterThan(big);
  });

  it('does not let one view and one like look perfect', () => {
    expect(qualityPart(stats({ likeCount: 1 }))).toBeLessThan(0.5);
  });

  it('values a tag tap more than a like', () => {
    expect(qualityPart(stats({ viewCount: 10, tagTapCount: 1 }))).toBeGreaterThan(
      qualityPart(stats({ viewCount: 9, likeCount: 1 })),
    );
  });

  it('stays between 0 and 1', () => {
    expect(qualityPart(stats({ viewCount: 0, likeCount: 500, saveCount: 500 }))).toBe(1);
    expect(qualityPart(stats())).toBeGreaterThanOrEqual(0);
  });
});

describe('isListingAvailableSoon', () => {
  it('needs the piece to be up', () => {
    expect(isListingAvailableSoon(listing({ status: 'paused' as Listing['status'] }), TODAY)).toBe(
      false,
    );
  });

  it('counts a piece for sale as available', () => {
    expect(isListingAvailableSoon(listing({ intent: 'sell', salePriceCents: 4000 }), TODAY)).toBe(
      true,
    );
  });

  it('is false when every day this week is booked or blacked out', () => {
    const week = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
    const rest = ['2026-10-26', '2026-10-27', '2026-10-28'];
    expect(isListingAvailableSoon(listing({ bookedDates: week, blackoutDates: rest }), TODAY)).toBe(
      false,
    );
    expect(isListingAvailableSoon(listing({ bookedDates: week }), TODAY)).toBe(true);
  });
});

describe('availablePart', () => {
  it('is the share of tagged pieces she can get, and 0 with no tags', () => {
    const map = new Map([
      ['ok', listing()],
      ['gone', listing({ status: 'removed' as Listing['status'] })],
    ]);
    expect(availablePart(['ok', 'gone'], (id) => map.get(id), TODAY)).toBe(0.5);
    expect(availablePart(['missing'], (id) => map.get(id), TODAY)).toBe(0);
    expect(availablePart([], (id) => map.get(id), TODAY)).toBe(0);
  });
});

describe('rankPosts', () => {
  const input = {
    viewer: viewer({ following: new Set(['friend']) }),
    listings: () => undefined,
    nowMs: NOW,
    today: TODAY,
  };

  it('puts a friend’s new look above a stranger’s old one', () => {
    const ranked = rankPosts(
      [
        { ...post('old'), created: NOW - 96 * HOUR },
        { ...post('friend', { authorUid: 'friend' }), created: NOW - HOUR },
      ],
      (p) => p.created,
      input,
    );
    expect(ranked.map((r) => r.post.id)).toEqual(['friend', 'old']);
  });

  it('breaks ties by newest, then id, so the order is stable', () => {
    const ranked = rankPosts(
      [
        { ...post('b'), created: NOW },
        { ...post('a'), created: NOW },
      ],
      (p) => p.created,
      input,
    );
    expect(ranked.map((r) => r.post.id)).toEqual(['a', 'b']);
  });

  it('explains every part and adds them up with the weights', () => {
    const b = explainScore({ ...post('x', { authorUid: 'friend' }), createdAtMs: NOW }, input);
    const w = FEED_RANKING.weights;
    const sum =
      b.parts.who * w.who +
      b.parts.what * w.what +
      b.parts.fresh * w.fresh +
      b.parts.quality * w.quality +
      b.parts.available * w.available;
    expect(b.score).toBeCloseTo(sum);
    expect(b.parts.fresh).toBe(1);
  });
});

describe('buildOccasionAffinity', () => {
  it('counts each look once per occasion and caps each occasion', () => {
    const a = buildOccasionAffinity(
      [['gameday', 'gameday'], ['gameday', 'formal'], ...Array(30).fill(['rush'])],
      20,
    );
    expect(a.get('gameday')).toBe(2);
    expect(a.get('formal')).toBe(1);
    expect(a.get('rush')).toBe(20);
  });
});
