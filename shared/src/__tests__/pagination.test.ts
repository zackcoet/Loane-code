import { describe, expect, it } from 'vitest';
import { isLastPage, mergePages, PAGE_SIZES } from '../pagination';

describe('mergePages', () => {
  it('puts the live page first, then older pages', () => {
    expect(mergePages([{ id: 'c' }, { id: 'b' }], [{ id: 'a' }]).map((x) => x.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('keeps one copy of an item in both, and it is the live one', () => {
    const merged = mergePages(
      [{ id: 'b', text: 'edited' }],
      [
        { id: 'b', text: 'old' },
        { id: 'a', text: 'x' },
      ],
    );
    expect(merged).toEqual([
      { id: 'b', text: 'edited' },
      { id: 'a', text: 'x' },
    ]);
  });

  it('copes with nothing loaded yet', () => {
    expect(mergePages([], [])).toEqual([]);
  });
});

describe('isLastPage', () => {
  it('a full page might have more behind it; a short one does not', () => {
    expect(isLastPage(PAGE_SIZES.messages, PAGE_SIZES.messages)).toBe(false);
    expect(isLastPage(PAGE_SIZES.messages - 1, PAGE_SIZES.messages)).toBe(true);
    expect(isLastPage(0, PAGE_SIZES.messages)).toBe(true);
  });
});

describe('people search page', () => {
  it('fetches more than it shows, so dropped accounts do not leave her short', () => {
    expect(PAGE_SIZES.peopleSearch).toBeGreaterThan(PAGE_SIZES.peopleSearchShown);
    expect(PAGE_SIZES.peopleSearchShown).toBeGreaterThan(0);
  });
});
