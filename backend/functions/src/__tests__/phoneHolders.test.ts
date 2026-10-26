/** Who a stored phone hash matches. Needs no emulator. */
import { describe, expect, it } from 'vitest';
import { holdersOf, matchedUid, rowFor } from '../lib/phoneHolders';

describe('holdersOf', () => {
  it('reads an older row with only a uid as a list of one', () => {
    expect(holdersOf({ uid: 'ella' })).toEqual(['ella']);
  });

  it('reads the list when there is one', () => {
    expect(holdersOf({ uid: null, uids: ['ella', 'anna'] })).toEqual(['ella', 'anna']);
  });

  it('is empty for no row, or junk', () => {
    expect(holdersOf(undefined)).toEqual([]);
    expect(holdersOf({ uid: '' })).toEqual([]);
    expect(holdersOf({ uids: ['', 3 as never] })).toEqual([]);
  });
});

describe('matchedUid', () => {
  it('matches the one girl who holds it', () => {
    expect(matchedUid({ uid: 'ella', uids: ['ella'] })).toBe('ella');
    expect(matchedUid({ uid: 'ella' })).toBe('ella');
  });

  it('matches nobody when two accounts claim the number', () => {
    expect(matchedUid({ uid: null, uids: ['ella', 'anna'] })).toBeNull();
  });

  it('never trusts a stale uid over the list', () => {
    expect(matchedUid({ uid: 'ella', uids: ['ella', 'anna'] })).toBeNull();
  });
});

describe('rowFor', () => {
  it('names the one holder', () => {
    expect(rowFor(['ella'])).toEqual({ uid: 'ella', uids: ['ella'] });
  });

  it('names nobody when shared', () => {
    expect(rowFor(['ella', 'anna'])).toEqual({ uid: null, uids: ['ella', 'anna'] });
  });

  it('says delete when nobody holds it', () => {
    expect(rowFor([])).toBeNull();
  });
});
