/**
 * Rate limits on the functions that create things.
 *
 * THE LIMITS ARE SET SO A NORMAL STUDENT NEVER MEETS ONE. They are not
 * a fairness mechanism or a quota — they are there so that a stolen
 * token, a runaway client or somebody with a script cannot post a
 * thousand comments or fire ten thousand rental requests before anyone
 * notices. If a real student ever hits one of these, the number is
 * wrong and should be raised rather than defended.
 *
 * A FIXED WINDOW, NOT A ROLLING ONE. A rolling window needs every
 * timestamp kept and re-counted; a fixed window is one document and
 * one transaction. The cost is that somebody can send a burst at the
 * end of one window and another at the start of the next — which is
 * fine, because this is a ceiling on catastrophe, not a smoothing
 * device.
 *
 * COUNTED IN A TRANSACTION, because the whole point is somebody firing
 * many requests at once, and a read-then-write would let them all pass
 * the check together.
 */

import { logger } from 'firebase-functions';
import { COLLECTIONS } from '@loane/shared';
import { db, now } from './admin';
import { failed } from './errors';

export interface Limit {
  /** How many in the window. */
  max: number;
  windowMs: number;
  /** Shown to her when she hits it. Never mentions numbers or limits. */
  message: string;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/**
 * Every limit in one place, so they can be read against each other.
 *
 * The comments are what a heavy-but-real student looks like, because
 * that is the number these have to clear.
 */
export const LIMITS = {
  /** A student setting up one account, maybe retrying a bad password. */
  signUp: { max: 5, windowMs: HOUR, message: 'Too many sign-ups from here. Try again later.' },

  /** Asking for six dresses before a formal is a busy evening, not abuse. */
  rentalRequest: {
    max: 20,
    windowMs: DAY,
    message: 'You have sent a lot of requests today. Try again tomorrow.',
  },

  /** Posting a look is a considered act; nobody does ten in an hour. */
  post: { max: 10, windowMs: HOUR, message: 'You are posting very fast. Try again in a bit.' },

  /** A chatty night under her friends' looks. */
  comment: { max: 60, windowMs: HOUR, message: 'Slow down a moment, then try again.' },

  /** Following everybody she knows on her first evening. */
  follow: { max: 100, windowMs: HOUR, message: 'That is a lot of following. Try again shortly.' },

  /** Starting chats with lenders. */
  conversation: {
    max: 30,
    windowMs: HOUR,
    message: 'You have started a lot of chats. Try again shortly.',
  },

  /**
   * Sending a look or a piece to friends. Each send can reach ten
   * people, so this is sends, not messages — thirty is a very social
   * evening of "omg would this work for Saturday".
   */
  share: { max: 30, windowMs: HOUR, message: 'You are sending a lot. Try again shortly.' },

  /**
   * Reporting. Deliberately generous: somebody reporting a lot of
   * content is usually somebody having a bad time, not an attacker,
   * and the last thing to do is stop her telling us.
   */
  report: { max: 20, windowMs: DAY, message: 'Thanks — we already have several from you today.' },
  /** Downloading her data reads everything she has. Nobody needs it hourly. */
  dataExport: {
    max: 3,
    windowMs: DAY,
    message: 'You have downloaded your data a few times today. Try again tomorrow.',
  },
} as const satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

interface Counter {
  count: number;
  windowStartedAt: FirebaseFirestore.Timestamp;
}

/**
 * Counts one action against a limit, and throws when it is exceeded.
 *
 * `key` is usually her uid. For sign-up there is no uid yet, so it is
 * the caller's IP — the only thing we have before an account exists.
 */
export async function rateLimit(key: string, name: LimitName): Promise<void> {
  const limit = LIMITS[name];
  // A scope that cannot collide with a uid-keyed document elsewhere.
  const ref = db().collection(COLLECTIONS.rateLimits).doc(`${name}__${key}`);

  const exceeded = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as Counter | undefined;
    const fresh =
      !current || current.windowStartedAt.toMillis() < Date.now() - limit.windowMs;

    if (fresh) {
      tx.set(ref, { count: 1, windowStartedAt: now() });
      return false;
    }

    if (current.count >= limit.max) return true;

    tx.update(ref, { count: current.count + 1 });
    return false;
  });

  if (exceeded) {
    // Worth a log line: a real student hitting one of these means the
    // number is wrong, and we only find that out by seeing it.
    logger.warn('Rate limit hit', { name, key });
    throw failed(limit.message);
  }
}

/** The caller's IP, for limiting something that happens before sign-in. */
export function callerIp(rawRequest: { ip?: string; headers?: Record<string, unknown> }): string {
  const forwarded = rawRequest.headers?.['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined;
  // Falling back to a constant would put every caller in one bucket and
  // lock out the world, so an unknown IP is simply not limited.
  return first || rawRequest.ip || 'unknown';
}
