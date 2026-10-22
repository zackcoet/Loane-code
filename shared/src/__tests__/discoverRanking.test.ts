import { describe, expect, it } from 'vitest';
import {
  explainListingScore,
  listingQualityPart,
  occasionsOfSaved,
  rankListings,
} from '../discoverRanking';
import type { RankingViewer } from '../feedRanking';
import type { Listing } from '../types/listing';

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

function listing(id: string, over: Partial<Listing> & { hoursAgo?: number } = {}) {
  const { hoursAgo = 1, ...rest } = over;
  return {
    id,
    ownerUid: 'owner',
    occasions: ['gameday'],
    status: 'active',
    intent: 'rent',
    salePriceCents: null,
    bookedDates: [],
    blackoutDates: [],
    stats: { viewCount: 0, saveCount: 0, tagCount: 0, completedRentals: 0 },
    hoursAgo,
    ...rest,
  } as unknown as Listing & { hoursAgo: number };
}
const created = (l: Listing) => NOW - (l as Listing & { hoursAgo: number }).hoursAgo * HOUR;

describe('listingQualityPart', () => {
  it('rewards saves and rentals per view, not raw totals', () => {
    const small = listingQualityPart({
      viewCount: 10,
      saveCount: 4,
      tagCount: 0,
      completedRentals: 1,
    });
    const big = listingQualityPart({
      viewCount: 600,
      saveCount: 20,
      tagCount: 0,
      completedRentals: 1,
    });
    expect(small).toBeGreaterThan(big);
  });

  it('does not call one view and one save perfect', () => {
    expect(
      listingQualityPart({ viewCount: 1, saveCount: 1, tagCount: 0, completedRentals: 0 }),
    ).toBeLessThan(1);
  });
});

describe('explainListingScore', () => {
  it('puts a piece she can get this week above one booked solid', () => {
    const free = listing('free');
    const booked = listing('booked', {
      bookedDates: [
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
        '2026-10-28',
      ],
    });
    const a = explainListingScore(free, created(free), viewer(), NOW, TODAY);
    const b = explainListingScore(booked, created(booked), viewer(), NOW, TODAY);
    expect(a.parts.available).toBe(1);
    expect(b.parts.available).toBe(0);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it('lifts pieces from closets she follows', () => {
    const v = viewer({ following: new Set(['friend']) });
    const mine = explainListingScore(listing('x', { ownerUid: 'friend' }), NOW, v, NOW, TODAY);
    const theirs = explainListingScore(listing('y'), NOW, v, NOW, TODAY);
    expect(mine.score).toBeGreaterThan(theirs.score);
  });
});

describe('rankListings', () => {
  it('orders by score, then newest, and never shuffles ties', () => {
    const list = [
      listing('b', { hoursAgo: 5 }),
      listing('a', { hoursAgo: 5 }),
      listing('new', { hoursAgo: 0 }),
    ];
    expect(rankListings(list, created, viewer(), NOW, TODAY)).toEqual(['new', 'a', 'b']);
  });

  it('uses the occasions of pieces she saved', () => {
    const formal = listing('formal', { occasions: ['formal'] });
    const gameday = listing('gameday', { occasions: ['gameday'] });
    const saved = occasionsOfSaved(['old-formal', 'missing'], (id) =>
      id === 'old-formal' ? { occasions: ['formal'] } : undefined,
    );
    expect(saved).toEqual([['formal']]);
    const v = viewer({ occasionAffinity: new Map([['formal', 1]]) });
    expect(rankListings([gameday, formal], created, v, NOW, TODAY)[0]).toBe('formal');
  });
});
