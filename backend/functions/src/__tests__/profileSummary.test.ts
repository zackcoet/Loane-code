/**
 * Which profile edits are copied onto her looks, pieces and chats.
 * Pure: no emulator needed.
 */

import { describe, expect, it } from 'vitest';
import type { User } from '@loane/shared';
import { summaryChanged, summaryOf } from '../triggers/propagateProfileChanges';

const base = {
  uid: 'u1',
  username: 'ella',
  displayName: 'Ella',
  photoUrl: 'https://example.com/a.jpg',
  campusId: 'university-of-south-carolina',
  isVerified: true,
  bio: 'hi',
} as unknown as User;

describe('summaryChanged', () => {
  it('ignores edits that are not copied anywhere', () => {
    expect(summaryChanged(base, { ...base, bio: 'new bio' } as User)).toBe(false);
  });

  it.each(['username', 'displayName', 'photoUrl', 'isVerified', 'campusId'] as const)(
    'notices a new %s',
    (field) => {
      const after = { ...base, [field]: field === 'isVerified' ? false : 'changed' } as User;
      expect(summaryChanged(base, after)).toBe(true);
    },
  );
});

describe('summaryOf', () => {
  it('copies exactly the summary fields', () => {
    expect(summaryOf(base)).toEqual({
      uid: 'u1',
      username: 'ella',
      displayName: 'Ella',
      photoUrl: 'https://example.com/a.jpg',
      campusId: 'university-of-south-carolina',
      isVerified: true,
    });
  });

  it('treats a missing photo as none', () => {
    const noPhoto = { ...base, photoUrl: undefined } as unknown as User;
    expect(summaryOf(noPhoto).photoUrl).toBeNull();
  });
});
