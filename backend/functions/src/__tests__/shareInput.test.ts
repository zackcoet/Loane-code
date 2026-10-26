/** Cleaning what the phone sends with a share. Needs no emulator. */
import { describe, expect, it } from 'vitest';
import { cleanNote, cleanRecipients } from '../messaging/sendToEach';

describe('cleanNote', () => {
  it('trims her note', () => {
    expect(cleanNote('  you need this  ')).toBe('you need this');
  });

  it('treats anything that is not text as no note', () => {
    for (const raw of [undefined, null, 42, {}, ['hi']]) expect(cleanNote(raw)).toBe('');
  });
});

describe('cleanRecipients', () => {
  it('drops duplicates and herself, keeping the order she picked', () => {
    expect(cleanRecipients(['anna', 'me', 'beth', 'anna'], 'me')).toEqual(['anna', 'beth']);
  });

  it('drops anything that is not an account id', () => {
    expect(cleanRecipients(['anna', '', 7, null, { uid: 'x' }], 'me')).toEqual(['anna']);
  });

  it('treats a list that is not a list as nobody', () => {
    for (const raw of [undefined, null, 'anna', { 0: 'anna' }]) {
      expect(cleanRecipients(raw, 'me')).toEqual([]);
    }
  });
});
