import { describe, expect, it } from 'vitest';
import { suggestUsername, suggestUsernames } from '../usernameSuggest';
import { validateUsername } from '../validation';
import { LIMITS, RESERVED_USERNAMES } from '../constants';

/**
 * The contract that matters: every suggestion must pass
 * `validateUsername`. A suggestion the server then rejects is worse than
 * no suggestion at all, because she has to work out what is wrong with a
 * name she did not choose.
 */

describe('suggestUsername', () => {
  it('uses the email local part, which she already recognises', () => {
    expect(
      suggestUsername({
        firstName: 'Ella',
        campusEmail: 'ellapetrick@email.sc.edu',
      }),
    ).toBe('ellapetrick');
  });

  it('falls back to the first name when there is no email', () => {
    expect(suggestUsername({ firstName: 'Ella' })).toBe('ella');
  });

  it('folds accents rather than dropping the letters', () => {
    expect(suggestUsername({ campusEmail: 'renée.dubois@sc.edu' })).toBe('renee.dubois');
    expect(suggestUsername({ firstName: 'Zoë' })).toBe('zoe');
  });

  it('strips characters a username cannot contain', () => {
    // Hyphen, space and apostrophe are all illegal; the letters survive.
    expect(suggestUsername({ campusEmail: "mary-jane o'hara@sc.edu" })).toBe('maryjaneohara');
  });

  it('does not leave a leading or trailing period', () => {
    expect(suggestUsername({ campusEmail: '.ella.@sc.edu' })).toBe('ella');
  });

  it('collapses runs of periods', () => {
    expect(suggestUsername({ campusEmail: 'ella..petrick@sc.edu' })).toBe('ella.petrick');
  });

  it('refuses to propose an all-digits student number', () => {
    // Legal, but it reads as an account number rather than a person.
    expect(suggestUsername({ campusEmail: '2847193@sc.edu' })).toBe('');
  });

  it('never proposes a reserved name', () => {
    for (const reserved of RESERVED_USERNAMES) {
      expect(suggestUsername({ campusEmail: `${reserved}@sc.edu` })).toBe('');
    }
  });

  it('returns empty rather than something invalid when it has nothing', () => {
    expect(suggestUsername({})).toBe('');
    expect(suggestUsername({ firstName: '', campusEmail: '' })).toBe('');
    expect(suggestUsername({ campusEmail: '...@sc.edu' })).toBe('');
  });

  it('suffixes a name too short to stand alone', () => {
    // "jo" is below the three-character minimum, but "jocloset" is a
    // perfectly good suggestion and better than an empty field.
    expect(suggestUsername({ firstName: 'Jo' })).toBe('jocloset');
  });

  it('truncates a very long address to the limit', () => {
    const long = 'a'.repeat(80);
    const result = suggestUsername({ campusEmail: `${long}@sc.edu` });
    expect(result.length).toBe(LIMITS.username.max);
    expect(validateUsername(result).ok).toBe(true);
  });
});

describe('suggestUsernames', () => {
  const inputs = [
    { firstName: 'Ella', campusEmail: 'ellapetrick@email.sc.edu' },
    { firstName: 'Ella', campusEmail: 'epetrick27@sc.edu' },
    { firstName: 'Mary-Jane', campusEmail: "o'hara.mj@email.sc.edu" },
    { firstName: 'Zoë', campusEmail: 'zoe@sc.edu' },
    { firstName: 'A', campusEmail: 'ab@sc.edu' },
    { firstName: '', campusEmail: '...@sc.edu' },
    { firstName: 'Jo', campusEmail: '2847193@sc.edu' },
    { firstName: 'a'.repeat(90), campusEmail: `${'b'.repeat(90)}@sc.edu` },
    {},
  ];

  it('only ever returns names that pass validateUsername', () => {
    for (const input of inputs) {
      for (const candidate of suggestUsernames(input, 20)) {
        expect(validateUsername(candidate).ok, `${candidate} from ${JSON.stringify(input)}`).toBe(
          true,
        );
      }
    }
  });

  it('returns no duplicates', () => {
    for (const input of inputs) {
      const list = suggestUsernames(input, 20);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('respects the limit', () => {
    const list = suggestUsernames(
      { firstName: 'Ella', campusEmail: 'ellapetrick@email.sc.edu' },
      5,
    );
    expect(list.length).toBe(5);
  });

  it('offers the plain name first, then readable variants', () => {
    const list = suggestUsernames({
      firstName: 'Ella',
      campusEmail: 'ellapetrick@email.sc.edu',
    });
    expect(list[0]).toBe('ellapetrick');
    // Her first name is a legitimate second option.
    expect(list).toContain('ella');
    // And the suffixed forms are there for when both are taken.
    expect(list).toContain('ellapetrickcloset');
  });

  it('keeps numbered variants distinct at the length limit', () => {
    const long = 'a'.repeat(40);
    const list = suggestUsernames({ campusEmail: `${long}@sc.edu` }, 10);
    expect(new Set(list).size).toBe(list.length);
    for (const candidate of list) {
      expect(candidate.length).toBeLessThanOrEqual(LIMITS.username.max);
    }
  });

  it('gives something for a numeric address even though the single pick refuses', () => {
    // suggestUsername declines an all-digits name; the LIST still offers
    // the first-name forms, which is what the screen cycles through.
    const list = suggestUsernames({ firstName: 'Jo', campusEmail: '2847193@sc.edu' }, 6);
    for (const candidate of list) expect(validateUsername(candidate).ok).toBe(true);
  });
});
