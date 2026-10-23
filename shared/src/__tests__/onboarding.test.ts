import { describe, expect, it } from 'vitest';
import {
  cleanOccasionPicks,
  isOnboardingIntent,
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
