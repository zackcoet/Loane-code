/** Which edited text the word filter looks at. Needs no emulator. */
import { describe, expect, it } from 'vitest';
import { changedText } from '../moderation/changedText';

type Doc = { name: string; description: string; price: number };
const FIELDS = ['name', 'description'] as const;
const base: Doc = { name: 'Red mini', description: 'Worn once', price: 2500 };

describe('changedText', () => {
  it('checks every text field on a new document', () => {
    expect(changedText(undefined, base, FIELDS)).toBe('Red mini\nWorn once');
  });

  it('checks only the field she changed', () => {
    expect(changedText(base, { ...base, description: 'New words' }, FIELDS)).toBe('New words');
  });

  it('skips a save that changed no text', () => {
    expect(changedText(base, { ...base, price: 3000 }, FIELDS)).toBeNull();
  });

  it('skips text she emptied', () => {
    expect(changedText(base, { ...base, description: '  ' }, FIELDS)).toBeNull();
  });
});
