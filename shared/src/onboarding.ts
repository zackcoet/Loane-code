/**
 * The "Get started" steps a new student sees once, straight after she
 * creates her account: how she will use Loane, what's coming up, and
 * (optionally) her size.
 *
 * Every step can be skipped. What she picks is stored on her PRIVATE
 * settings document (`users/{uid}/private/settings.onboarding`), because
 * it is about her and only her phone needs it: the For You feed and
 * Discover rank on her phone (docs/feed-algorithm.md), so a starter set
 * of occasions never has to leave it. It moves no counter and grants
 * nothing, which is why the app may write it — the rules check its shape.
 */

import { OCCASIONS, type Occasion } from './constants';
import type { Timestampish } from './types/common';

/** How she means to use Loane. "both" is the default answer, not a third kind of user. */
export const ONBOARDING_INTENTS = ['rent', 'lend', 'both'] as const;
export type OnboardingIntent = (typeof ONBOARDING_INTENTS)[number];

export const ONBOARDING_INTENT_COPY: Record<OnboardingIntent, { title: string; detail: string }> = {
  rent: { title: 'Find something to wear', detail: 'Loane It or Own It from closets on campus.' },
  lend: { title: 'Earn from my closet', detail: 'Put my pieces on Loane for other girls.' },
  both: { title: 'Both', detail: 'Borrow for the weekend, lend the rest of the week.' },
};

/**
 * How much one picked occasion counts, in "liked looks".
 *
 * Her starter picks have to lift the feed on day one, when she has
 * liked nothing, and then fade into the background once she has: three
 * liked Formal looks already outweigh one pick. Engagement is capped at
 * 20 per occasion (`buildOccasionAffinity`), so a pick can never decide
 * the feed for somebody who actually uses the app.
 */
export const PICKED_OCCASION_WEIGHT = 3;

export interface UserOnboarding {
  intent: OnboardingIntent | null;
  /** The occasions she said are coming up. Empty if she skipped. */
  occasions: Occasion[];
  /**
   * When she finished or skipped the steps. A timestamp for the same
   * reason as the walkthrough's: skipping is an answer, and "when"
   * tells us which accounts signed up before these steps existed.
   */
  completedAt: Timestampish | null;
}

/** Keeps only real occasions, once each, in the canonical order. */
export function cleanOccasionPicks(picks: readonly string[]): Occasion[] {
  const set = new Set(picks);
  return OCCASIONS.filter((o) => set.has(o));
}

export function isOnboardingIntent(value: unknown): value is OnboardingIntent {
  return typeof value === 'string' && (ONBOARDING_INTENTS as readonly string[]).includes(value);
}

/**
 * Folds her starter picks into the occasion affinity built from what
 * she engaged with. Returns a new map; the input is left alone.
 */
export function withPickedOccasions(
  affinity: ReadonlyMap<Occasion, number>,
  picked: readonly Occasion[] | null | undefined,
  weight = PICKED_OCCASION_WEIGHT,
): Map<Occasion, number> {
  const out = new Map(affinity);
  for (const o of new Set(picked ?? [])) {
    out.set(o, (out.get(o) ?? 0) + weight);
  }
  return out;
}
