/**
 * The hourly message ceiling — which write to send alongside a message.
 *
 * Messages are written by the app so they feel instant, so the limit
 * cannot live in a function. Instead every message goes in a batch with
 * a write to `messageQuotas/{uid}`, and the security rules refuse the
 * message unless that counter moved by exactly one and is still under
 * the ceiling. One round trip, same as before.
 *
 * The counter is a fixed one-hour window: `windowStart` and `count`.
 * Starting a new window is only allowed once the server agrees the old
 * one is over, so the phone can never reset its own counter early.
 *
 * New listings use exactly the same counter shape (listingQuotas), so
 * these helpers take the window length rather than assuming messages.
 */

import { LIMITS } from './constants';
import { toMillis } from './dates';

export interface MessageQuota {
  /** Server time the current window opened. */
  windowStart: unknown;
  count: number;
}

/**
 * A little past the hour before asking for a fresh window, so a phone
 * whose clock runs a minute fast does not ask too early and have its
 * message refused.
 */
const CLOCK_SLACK_MS = 2 * 60_000;

/**
 * `start` — open a new window (no counter yet, or the old one is over).
 * `bump` — add one to the current window.
 */
export function quotaWrite(
  current: MessageQuota | null,
  nowMs: number,
  windowMs: number = LIMITS.messagesPerHour.windowMs,
): 'start' | 'bump' {
  if (!current) return 'start';
  const startMs = toMillis(current.windowStart);
  // A window still waiting for its server time is brand new.
  if (startMs == null) return 'bump';
  return nowMs - startMs > windowMs + CLOCK_SLACK_MS ? 'start' : 'bump';
}

/** The other choice, for a single retry if the server disagreed. */
export function otherQuotaWrite(choice: 'start' | 'bump'): 'start' | 'bump' {
  return choice === 'start' ? 'bump' : 'start';
}
