import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { failed, internal, invalidArgument } from './errors';

/**
 * The only place in Loane that talks to Stripe.
 *
 * Everything money-shaped goes through here, for two reasons:
 *
 * 1. Going live must be a KEY SWAP AND NOTHING ELSE. So no Stripe account
 *    id, webhook id or price id is ever written in code. The secret key and
 *    the webhook signing secret come from Secret Manager; the publishable
 *    key is app config. Swap those and the whole thing points somewhere new.
 *
 * 2. The API version is pinned. Stripe ships breaking changes behind dated
 *    versions, and discovering one of those by way of a charge behaving
 *    differently is not a thing that should be possible.
 *
 * Phase 5 is built against a separate "Loane Test" Stripe account, because
 * Loane, Inc.'s own account cannot enable Connect until its incorporation
 * finishes. See docs/payments.md.
 */

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

/**
 * Set with:
 *   firebase functions:secrets:set STRIPE_SECRET_KEY --project loane-code
 *
 * Never in a .env file, never in the repo, never pasted into a chat. Any
 * function that touches Stripe must list these in its `secrets` option or
 * the value is simply absent at runtime.
 */
export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

/** Convenience for the `secrets:` option on a function definition. */
export const STRIPE_SECRETS = [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET];

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

/**
 * Pinned deliberately. Matches the version the installed SDK was generated
 * against; bump both together and read Stripe's changelog when you do.
 */
const API_VERSION = '2026-09-30.endive';

let client: Stripe | null = null;
let clientKey: string | null = null;

/**
 * The Stripe client, built on first use.
 *
 * Lazy because `defineSecret` values are not readable at module load time,
 * only inside a request. Rebuilt if the key changes, which is what makes
 * rotating a key a deploy and not a code change.
 */
export function stripe(): Stripe {
  const key = STRIPE_SECRET_KEY.value();
  if (!key) {
    // A missing secret is a deploy mistake, not a user mistake, so it says
    // nothing useful to her and everything useful to the log.
    logger.error('STRIPE_SECRET_KEY is not set. Run firebase functions:secrets:set.');
    throw internal('Payments are temporarily unavailable.');
  }

  if (!client || clientKey !== key) {
    client = new Stripe(key, {
      apiVersion: API_VERSION,
      // Stripe retries network-level failures itself. Two is enough to ride
      // out a blip without turning a slow call into a very slow one.
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: 'Loane', url: 'https://joinloane.com' },
    });
    clientKey = key;
  }

  return client;
}

// ---------------------------------------------------------------------------
// Which account are we pointed at?
// ---------------------------------------------------------------------------

/** True when the configured key is a test-mode key. */
export function isTestMode(): boolean {
  return STRIPE_SECRET_KEY.value().startsWith('sk_test_');
}

/**
 * Refuse to run unless we are in test mode.
 *
 * For the live-flow scripts, which create and delete real objects. The
 * danger is not today — it is the day someone runs a test script after the
 * keys have been swapped to Loane, Inc.'s live account.
 */
export function assertTestMode(what: string): void {
  if (!isTestMode()) {
    throw failed(`${what} refuses to run against a live Stripe key.`);
  }
}

let cachedPlatformAccountId: string | null = null;

/**
 * The id of the Stripe account Loane itself is operating as.
 *
 * Stamped onto every user alongside their Connect account and customer ids,
 * because those ids belong to the platform that created them. When Loane
 * moves to its own Stripe account, a stale id is then something we can
 * detect and ask her to reconnect for, rather than an error nobody can
 * explain. Cached for the life of the instance; it does not change.
 */
export async function platformAccountId(): Promise<string> {
  if (!cachedPlatformAccountId) {
    // retrieveCurrent, not retrieve(null) — same endpoint, but it says what
    // it means and cannot be confused with fetching a lender's account.
    cachedPlatformAccountId = (await stripe().accounts.retrieveCurrent()).id;
  }
  return cachedPlatformAccountId;
}

// ---------------------------------------------------------------------------
// Payment method configuration
// ---------------------------------------------------------------------------

/**
 * How Loane asks for payment methods.
 *
 * `payment_method_types` was REMOVED in API version 2026-09-30 — passing it
 * is a hard 400. Methods come from the Stripe Dashboard now, selected
 * dynamically per payment.
 *
 * `allow_redirects: 'never'` is the part that matters for us. A method that
 * redirects the renter to her bank's own page cannot be charged later
 * without her present, and Loane's whole protection model depends on being
 * able to charge an approved claim off-session, days after the rental. So
 * we take only methods that leave behind something reusable — in practice
 * card and Link.
 */
export const PAYMENT_METHOD_CONFIG = {
  enabled: true,
  allow_redirects: 'never',
} as const satisfies Stripe.PaymentIntentCreateParams.AutomaticPaymentMethods;

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * A stable key for an operation, so a retry cannot do it twice.
 *
 * Cloud Functions retry. Stripe webhooks retry. A client on a flaky campus
 * wifi connection retries. Without this, "capture the payment" running
 * twice is two charges on a real card.
 *
 * The key must be derived from WHAT is being done, never from the clock or
 * a random value, or a retry generates a fresh key and the protection is
 * gone. `attempt` exists for the one case where repeating is intended —
 * replacing a lapsed authorization.
 */
export function idempotencyKey(
  action: string,
  bookingId: string,
  attempt = 0,
): string {
  return attempt > 0
    ? `loane:${action}:${bookingId}:${attempt}`
    : `loane:${action}:${bookingId}`;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Turn a Stripe failure into something worth showing a student.
 *
 * "Your card was declined" is actionable. "StripeCardError" is not, and
 * neither is "internal". Stripe's own `message` is written for end users on
 * card errors, so we pass it through there and keep our own wording for
 * everything else.
 */
export function toUserFacingError(err: unknown, context: string): never {
  if (err instanceof Stripe.errors.StripeError) {
    logger.error(`Stripe ${err.type} during ${context}`, {
      code: err.code,
      declineCode: err.decline_code,
      requestId: err.requestId,
    });

    switch (err.type) {
      case 'StripeCardError':
        // Safe and useful: "Your card has insufficient funds."
        throw failed(err.message ?? 'Your card was declined.');
      case 'StripeInvalidRequestError':
        // We built a bad request. That is our bug, not hers.
        throw internal('Something went wrong taking payment. Try again.');
      case 'StripeRateLimitError':
      case 'StripeConnectionError':
      case 'StripeAPIError':
        throw internal('Payments are busy right now. Try again in a moment.');
      case 'StripeAuthenticationError':
        logger.error('Stripe rejected our API key.');
        throw internal('Payments are temporarily unavailable.');
      default:
        throw internal('Something went wrong taking payment. Try again.');
    }
  }

  logger.error(`Unexpected error during ${context}`, err as Error);
  throw internal('Something went wrong taking payment. Try again.');
}

/**
 * Stripe amounts are integers in the smallest currency unit, which for USD
 * is cents — the same unit Loane stores. This guards the boundary anyway,
 * because a float reaching Stripe is rejected with a confusing error and a
 * negative one would be a very bad day.
 */
export function assertChargeable(cents: number, what: string): void {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw invalidArgument(`${what} must be a whole number of cents above zero.`);
  }
  // Stripe's own per-charge ceiling. Nothing on a campus clothes rental app
  // should come close, so hitting it means a bug upstream in the maths.
  if (cents > 99_999_999) {
    throw invalidArgument(`${what} is too large.`);
  }
}
