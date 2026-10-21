import { describe, expect, it } from 'vitest';
import { flaggedTerms, normalizeForFilter } from '../contentFilter';

describe('normalizeForFilter', () => {
  it('undoes capitals, l33t, accents and punctuation', () => {
    expect(normalizeForFilter('K1LL   y0urself!!')).toBe('kill yourself');
    expect(normalizeForFilter("I'm")).toBe('im');
    expect(normalizeForFilter('fàg')).toBe('fag');
  });
});

describe('flaggedTerms', () => {
  it('catches threats however they are typed', () => {
    expect(flaggedTerms('just kys')).toEqual(['kys']);
    expect(flaggedTerms('Go. Die.')).toEqual(['go die']);
    expect(flaggedTerms("I'm going to kill you")).toEqual(['im going to kill you']);
  });

  it('matches whole words only, so ordinary words are safe', () => {
    // The Scunthorpe problem: a slur hiding inside a normal word.
    expect(flaggedTerms('Spice up your gameday fit')).toEqual([]);
    expect(flaggedTerms('fagioli for dinner')).toEqual([]);
    expect(flaggedTerms('this dress will kill at formal')).toEqual([]);
    expect(flaggedTerms('skills')).toEqual([]);
  });

  it('leaves normal Loane chatter alone', () => {
    for (const ok of [
      'Is this still available for Saturday?',
      'Obsessed with this look 😍',
      'Can we meet at Russell House at 5?',
      '',
    ]) {
      expect(flaggedTerms(ok)).toEqual([]);
    }
    expect(flaggedTerms(null)).toEqual([]);
  });
});
