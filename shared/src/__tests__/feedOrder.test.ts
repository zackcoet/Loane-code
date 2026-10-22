import { describe, expect, it } from 'vitest';
import { diversifyFeed, nextFeedOrder, rankAndDiversify } from '../feedOrder';
import type { RankingInput } from '../feedRanking';
import type { Post } from '../types/post';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 22, 12);

function input(following: string[] = []): RankingInput {
  return {
    viewer: {
      uid: 'me',
      following: new Set(following),
      followers: new Set(),
      interactions: new Map(),
      occasionAffinity: new Map(),
    },
    listings: () => undefined,
    nowMs: NOW,
    today: '2026-10-22',
  };
}

interface TestPost extends Pick<
  Post,
  'id' | 'authorUid' | 'occasions' | 'stats' | 'taggedListingIds'
> {
  hoursAgo: number | null;
}

function post(id: string, authorUid: string, hoursAgo: number | null, likeCount = 0): TestPost {
  return {
    id,
    authorUid,
    hoursAgo,
    occasions: [],
    taggedListingIds: [],
    stats: {
      likeCount,
      saveCount: 0,
      viewCount: 0,
      tagTapCount: 0,
      commentCount: 0,
      shareCount: 0,
    },
  };
}
const created = (p: TestPost) => (p.hoursAgo === null ? null : NOW - p.hoursAgo * HOUR);
const authors = (ps: { authorUid: string }[]) => ps.map((p) => p.authorUid).join('');
const never = () => false;

describe('diversifyFeed — no more than two in a row', () => {
  it('breaks up a run of one girl', () => {
    const ranked = ['a', 'a', 'a', 'a', 'b', 'c'].map((u) => ({ authorUid: u }));
    expect(authors(diversifyFeed(ranked, { isFamiliar: never }))).toBe('aabaac');
  });

  it('leaves an order that already obeys the rules alone', () => {
    const ranked = ['a', 'b', 'a', 'c', 'b'].map((u) => ({ authorUid: u }));
    expect(authors(diversifyFeed(ranked, { isFamiliar: never }))).toBe('abacb');
  });

  it('never drops a look, even when only one girl is left', () => {
    const ranked = ['a', 'a', 'a', 'a'].map((u, i) => ({ authorUid: u, i }));
    const out = diversifyFeed(ranked, { isFamiliar: never });
    expect(out).toHaveLength(4);
    expect(out.map((p) => p.i)).toEqual([0, 1, 2, 3]);
  });

  it('counts the looks already on screen above a new page', () => {
    const ranked = ['a', 'b'].map((u) => ({ authorUid: u }));
    expect(authors(diversifyFeed(ranked, { isFamiliar: never }, ['a', 'a']))).toBe('ba');
  });
});

describe('diversifyFeed — discovery', () => {
  const friends = new Set(['f', 'g', 'h']);
  const isFamiliar = (u: string) => friends.has(u);

  it('lifts a stranger into every fourth slot when friends fill the top', () => {
    const ranked = ['f', 'g', 'h', 'f', 'g', 'h', 's', 't'].map((u) => ({ authorUid: u }));
    const out = authors(diversifyFeed(ranked, { isFamiliar }));
    expect(out).toBe('fghsfght');
  });

  it('does nothing when there are no strangers left', () => {
    const ranked = ['f', 'g', 'h', 'f', 'g'].map((u) => ({ authorUid: u }));
    expect(authors(diversifyFeed(ranked, { isFamiliar }))).toBe('fghfg');
  });
});

describe('rankAndDiversify', () => {
  it('treats her own looks as familiar, not discovery', () => {
    const posts = [
      post('1', 'me', 1),
      post('2', 'f', 1),
      post('3', 'me', 1),
      post('4', 'f', 1),
      post('5', 's', 40),
    ];
    const out = rankAndDiversify(posts, created, input(['f']));
    expect(out[3]!.authorUid).toBe('s');
  });
});

describe('nextFeedOrder', () => {
  it('ranks everything on the first load', () => {
    const posts = [post('old-popular', 'a', 2, 30), post('new', 'b', 1)];
    expect(nextFeedOrder([], posts, created, input())).toEqual(['old-popular', 'new']);
  });

  it('keeps placed looks where they are when their scores change', () => {
    const before = [post('x', 'a', 1), post('y', 'b', 2)];
    const order = nextFeedOrder([], before, created, input());
    expect(order).toEqual(['x', 'y']);
    // y gets a pile of likes while she is reading: it does not jump.
    const after = [post('x', 'a', 1), post('y', 'b', 2, 50)];
    expect(nextFeedOrder(order, after, created, input())).toEqual(['x', 'y']);
  });

  it('puts brand-new uploads on top and the next page at the bottom', () => {
    const page1 = [post('p1', 'a', 1), post('p2', 'b', 2)];
    const order = nextFeedOrder([], page1, created, input());
    const more = [
      post('just-posted', 'c', 0),
      post('unsaved', 'd', null),
      ...page1,
      post('older-1', 'e', 30),
      post('older-2', 'f', 31, 40),
    ];
    const next = nextFeedOrder(order, more, created, input());
    expect(next.slice(2, 4)).toEqual(order);
    expect(new Set(next.slice(0, 2))).toEqual(new Set(['just-posted', 'unsaved']));
    expect(next.slice(4)).toEqual(['older-2', 'older-1']);
  });

  it('drops looks that have gone', () => {
    const posts = [post('x', 'a', 1), post('y', 'b', 2)];
    const order = nextFeedOrder([], posts, created, input());
    expect(nextFeedOrder(order, [posts[1]!], created, input())).toEqual(['y']);
  });

  it('continues the variety rule across the seam with the next page', () => {
    const page1 = [post('a1', 'a', 1), post('a2', 'a', 2)];
    const order = nextFeedOrder([], page1, created, input());
    const more = [...page1, post('a3', 'a', 30, 50), post('b1', 'b', 31)];
    expect(nextFeedOrder(order, more, created, input())).toEqual(['a1', 'a2', 'b1', 'a3']);
  });
});
