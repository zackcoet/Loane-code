import { describe, expect, it } from 'vitest';
import { profileHref } from '../profileLink';

describe('profileHref', () => {
  it('carries her account id so a rename never opens the wrong girl', () => {
    expect(profileHref({ username: 'ella', uid: 'uid-ella' })).toBe('/u/ella?uid=uid-ella');
  });

  it('falls back to the handle alone when the copy has no id', () => {
    expect(profileHref({ username: 'ella' })).toBe('/u/ella');
    expect(profileHref({ username: 'ella', uid: null })).toBe('/u/ella');
  });

  it('adds where she came from after the id', () => {
    expect(profileHref({ username: 'ella', uid: 'u1' }, 'feed')).toBe('/u/ella?uid=u1&from=feed');
    expect(profileHref({ username: 'ella' }, 'suggested')).toBe('/u/ella?from=suggested');
  });

  it('escapes anything odd in a handle or id', () => {
    expect(profileHref({ username: 'a b', uid: 'x/y' })).toBe('/u/a%20b?uid=x%2Fy');
  });
});
