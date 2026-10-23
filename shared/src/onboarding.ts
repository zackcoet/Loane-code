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

// ---------------------------------------------------------------------------
// The admin funnel (F8)
// ---------------------------------------------------------------------------

/** The steps, in order, as logged in `onboarding_step` events' `meta.step`. */
export const ONBOARDING_STEPS = ['intent', 'occasions', 'size', 'follow', 'invite'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The bit of an `onboarding_step` event the funnel reads. */
export interface OnboardingStepEvent {
  uid: string | null;
  meta: Record<string, string | number | boolean>;
}

export interface OnboardingFunnelRow {
  label: string;
  value: number;
}

export interface OnboardingFunnel {
  rows: OnboardingFunnelRow[];
  /** Answers to "How will you use Loane?", one per student (her latest). */
  intents: Record<OnboardingIntent, number>;
}

/**
 * Turns `onboarding_step` events into the dashboard's funnel: how many
 * students reached each step, and how many actually answered it rather
 * than skipping. Each student counts once per row however many times
 * she went Back and forward.
 */
export function onboardingFunnel(events: readonly OnboardingStepEvent[]): OnboardingFunnel {
  const sets = {
    started: new Set<string>(),
    intent: new Set<string>(),
    occasions: new Set<string>(),
    size: new Set<string>(),
    followed3: new Set<string>(),
    invited: new Set<string>(),
    finished: new Set<string>(),
  };
  const latestIntent = new Map<string, OnboardingIntent>();

  for (const e of events) {
    if (!e.uid) continue;
    const step = e.meta?.step;
    const action = e.meta?.action;
    sets.started.add(e.uid);
    if (action === 'next' && step === 'intent' && isOnboardingIntent(e.meta.intent)) {
      sets.intent.add(e.uid);
      latestIntent.set(e.uid, e.meta.intent);
    }
    if (action === 'next' && step === 'occasions') sets.occasions.add(e.uid);
    if (action === 'next' && step === 'size') sets.size.add(e.uid);
    if (step === 'follow' && typeof e.meta.followed === 'number' && e.meta.followed >= 3) {
      sets.followed3.add(e.uid);
    }
    if (step === 'invite' && e.meta.invited === true) sets.invited.add(e.uid);
    // The last step, answered or skipped, or "Put a piece on Loane" from it.
    if (step === 'invite' || action === 'list_first') sets.finished.add(e.uid);
  }

  const intents: Record<OnboardingIntent, number> = { rent: 0, lend: 0, both: 0 };
  for (const i of latestIntent.values()) intents[i] += 1;

  return {
    rows: [
      { label: 'Started Get started', value: sets.started.size },
      { label: 'Said how she will use Loane', value: sets.intent.size },
      { label: "Picked what's coming up", value: sets.occasions.size },
      { label: 'Gave a size', value: sets.size.size },
      { label: 'Followed 3 closets', value: sets.followed3.size },
      { label: 'Invited friends', value: sets.invited.size },
      { label: 'Reached the feed', value: sets.finished.size },
    ],
    intents,
  };
}
