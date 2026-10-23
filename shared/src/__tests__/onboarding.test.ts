import { describe, expect, it } from 'vitest';
import {
  cleanOccasionPicks,
  isOnboardingIntent,
  onboardingFunnel,
  PICKED_OCCASION_WEIGHT,
  withPickedOccasions,
} from '../onboarding';
import { buildOccasionAffinity, whatPart } from '../feedRanking';

describe('cleanOccasionPicks', () => {
  it('drops made-up occasions and repeats, and keeps the usual order', () => {
    expect(cleanOccasionPicks(['rush', 'party', 'gameday', 'rush'])).toEqual(['gameday', 'rush']);
  });

  it('is empty for an empty pick', () => {
    expect(cleanOccasionPicks([])).toEqual([]);
  });
});

describe('isOnboardingIntent', () => {
  it('accepts the three answers only', () => {
    expect(isOnboardingIntent('rent')).toBe(true);
    expect(isOnboardingIntent('lend')).toBe(true);
    expect(isOnboardingIntent('both')).toBe(true);
    expect(isOnboardingIntent('buy')).toBe(false);
    expect(isOnboardingIntent(null)).toBe(false);
  });
});

describe('withPickedOccasions', () => {
  it('gives a brand-new student an interest before she has liked anything', () => {
    const affinity = withPickedOccasions(new Map(), ['formal']);
    expect(affinity.get('formal')).toBe(PICKED_OCCASION_WEIGHT);
    // A Formal look now scores on "what"; it scored 0 before.
    expect(whatPart(['formal'], { occasionAffinity: affinity } as never)).toBe(1);
    expect(whatPart(['gameday'], { occasionAffinity: affinity } as never)).toBe(0);
  });

  it('adds to what she engaged with rather than replacing it', () => {
    const engaged = buildOccasionAffinity([['gameday'], ['gameday'], ['gameday'], ['gameday']]);
    const affinity = withPickedOccasions(engaged, ['formal']);
    expect(affinity.get('gameday')).toBe(4);
    expect(affinity.get('formal')).toBe(PICKED_OCCASION_WEIGHT);
  });

  it('counts a pick once and leaves the input map alone', () => {
    const engaged = new Map([['rush' as const, 1]]);
    const affinity = withPickedOccasions(engaged, ['rush', 'rush']);
    expect(affinity.get('rush')).toBe(1 + PICKED_OCCASION_WEIGHT);
    expect(engaged.get('rush')).toBe(1);
  });

  it('does nothing when she skipped the step', () => {
    expect(withPickedOccasions(new Map(), undefined).size).toBe(0);
  });
});

describe('onboardingFunnel', () => {
  const ev = (uid: string, meta: Record<string, string | number | boolean>) => ({ uid, meta });

  it('counts each student once per row, answers apart from skips', () => {
    const { rows, intents } = onboardingFunnel([
      ev('a', { step: 'intent', action: 'next', intent: 'rent' }),
      ev('a', { step: 'occasions', action: 'next', occasionCount: 2 }),
      ev('a', { step: 'occasions', action: 'next', occasionCount: 3 }),
      ev('a', { step: 'size', action: 'skip' }),
      ev('a', { step: 'follow', action: 'next', followed: 3 }),
      ev('a', { step: 'invite', action: 'next', invited: true }),
      ev('b', { step: 'intent', action: 'skip' }),
      ev('b', { step: 'occasions', action: 'skip' }),
      ev('c', { step: 'intent', action: 'next', intent: 'lend' }),
      ev('c', { step: 'follow', action: 'skip', followed: 1 }),
      ev('c', { step: 'invite', action: 'list_first' }),
    ]);
    const value = (label: string) => rows.find((r) => r.label === label)?.value;
    expect(value('Started Get started')).toBe(3);
    expect(value('Said how she will use Loane')).toBe(2);
    expect(value("Picked what's coming up")).toBe(1);
    expect(value('Gave a size')).toBe(0);
    expect(value('Followed 3 closets')).toBe(1);
    expect(value('Invited friends')).toBe(1);
    expect(value('Reached the feed')).toBe(2);
    expect(intents).toEqual({ rent: 1, lend: 1, both: 0 });
  });

  it('uses her latest answer when she changed her mind', () => {
    const { intents } = onboardingFunnel([
      ev('a', { step: 'intent', action: 'next', intent: 'rent' }),
      ev('a', { step: 'intent', action: 'next', intent: 'both' }),
    ]);
    expect(intents).toEqual({ rent: 0, lend: 0, both: 1 });
  });
});
