import { describe, expect, it } from 'vitest';
import {
  activeMention,
  extractMentions,
  insertMention,
  mentionParts,
  MAX_MENTIONS_PER_COMMENT,
} from '../mentions';

describe('extractMentions', () => {
  it('finds handles, lowercase, once each, in order', () => {
    expect(extractMentions('@Maddie and @harper.k love this @maddie')).toEqual([
      'maddie',
      'harper.k',
    ]);
  });

  it('drops a trailing dot', () => {
    expect(extractMentions('thanks @ella.')).toEqual(['ella']);
  });

  it('never reads an email address as a mention', () => {
    expect(extractMentions('email me at ella@email.sc.edu')).toEqual([]);
  });

  it('ignores handles too short to be a username', () => {
    expect(extractMentions('@ab hi @')).toEqual([]);
  });

  it('caps how many people one comment can alert', () => {
    const body = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg'].map((h) => `@${h}`).join(' ');
    expect(extractMentions(body)).toHaveLength(MAX_MENTIONS_PER_COMMENT);
  });
});

describe('mentionParts', () => {
  it('splits handles from text and joins back to the body exactly', () => {
    const body = 'wear it with @maddie. to @harper_k!';
    const parts = mentionParts(body);
    expect(parts.map((p) => p.text).join('')).toBe(body);
    expect(parts.filter((p) => p.handle).map((p) => p.text)).toEqual(['@maddie', '@harper_k']);
  });

  it('is one plain part when there is nothing to link', () => {
    expect(mentionParts('so cute')).toEqual([{ text: 'so cute', handle: null }]);
  });
});

describe('activeMention', () => {
  it('sees the handle being typed at the cursor', () => {
    expect(activeMention('love it @mad', 12)).toEqual({ query: 'mad', start: 8 });
  });

  it('opens on a bare @', () => {
    expect(activeMention('@', 1)).toEqual({ query: '', start: 0 });
  });

  it('is null once she types a space after it', () => {
    expect(activeMention('@maddie ', 8)).toBeNull();
  });

  it('is null inside an email address', () => {
    expect(activeMention('ella@em', 7)).toBeNull();
  });
});

describe('insertMention', () => {
  it('replaces the partial handle and adds a space', () => {
    expect(insertMention('love it @mad', 12, 'maddie')).toEqual({
      text: 'love it @maddie ',
      cursor: 16,
    });
  });

  it('works mid-sentence without doubling the space', () => {
    const text = 'hi @ma see this';
    expect(insertMention(text, 6, 'maddie')).toEqual({
      text: 'hi @maddie see this',
      cursor: 11,
    });
  });

  it('does nothing when she is not mid-mention', () => {
    expect(insertMention('hello', 5, 'maddie')).toEqual({ text: 'hello', cursor: 5 });
  });
});
