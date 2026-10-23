import { describe, expect, it } from 'vitest';
import {
  addRecentSearch,
  matchingOccasions,
  MAX_RECENT_SEARCHES,
  removeRecentSearch,
} from '../recentSearches';

describe('addRecentSearch', () => {
  it('puts the newest first and drops an older copy, whatever the capitals', () => {
    expect(addRecentSearch(['red dress', 'Zara'], 'RED dress')).toEqual(['RED dress', 'Zara']);
  });

  it('tidies spaces and ignores one-letter searches', () => {
    expect(addRecentSearch([], '  black   heels ')).toEqual(['black heels']);
    expect(addRecentSearch(['a b'], 'x')).toEqual(['a b']);
  });

  it('keeps at most the cap', () => {
    let list: string[] = [];
    for (let i = 0; i < MAX_RECENT_SEARCHES + 5; i++) list = addRecentSearch(list, `term ${i}`);
    expect(list).toHaveLength(MAX_RECENT_SEARCHES);
    expect(list[0]).toBe(`term ${MAX_RECENT_SEARCHES + 4}`);
  });
});

describe('removeRecentSearch', () => {
  it('removes one, ignoring capitals', () => {
    expect(removeRecentSearch(['Zara', 'heels'], 'zara')).toEqual(['heels']);
  });
});

describe('matchingOccasions', () => {
  it('matches the start of any word in the name', () => {
    expect(matchingOccasions('form')).toEqual(['formal']);
    expect(matchingOccasions('out')).toEqual(['going_out']);
    expect(matchingOccasions('Date')).toEqual(['date_function']);
  });

  it('needs two letters', () => {
    expect(matchingOccasions('g')).toEqual([]);
  });

  it('matches nothing for an ordinary search', () => {
    expect(matchingOccasions('zara')).toEqual([]);
  });
});
