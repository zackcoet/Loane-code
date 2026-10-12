import type { Booking } from './types/booking';
import type { User } from './types/user';
import type { UserTryOn } from './types/tryOn';

/**
 * Default shapes for the documents Cloud Functions create.
 *
 * These blocks have a lot of fields, and several places build them: the real
 * callable, the emulator seed, and the rules tests. When they were separate
 * hand-written literals, adding a field meant remembering every copy — and a
 * seed producing documents of a different shape than the app does is exactly
 * what makes a bug look impossible to reproduce.
 *
 * Only Cloud Functions may write any of this. See CLAUDE.md.
 */

/** A booking's payment block before any money has moved. */
export function newBookingPayment(): Booking['payment'] {
  return {
    paymentIntentId: null,
    transferId: null,
    refundId: null,
    refundedCents: null,

    authorizedAt: null,
    authorizationExpiresAt: null,
    reauthorizedCount: 0,

    capturedAt: null,
    paidOutAt: null,

    liabilityAgreedAt: null,
    liabilityAgreedCapCents: null,

    claimPaymentIntentId: null,
    claimChargedCents: null,
    claimChargeFailedAt: null,
  };
}

/** A new user's Stripe block: no account, no card, no payouts. */
/**
 * A fresh try-on block. One definition, so an account created by
 * createAccount and one created by the seed script cannot disagree
 * about what "has not used any" looks like.
 */
export function newUserTryOn(): UserTryOn {
  return {
    bodyPhotoPath: null,
    bodyPhotoUploadedAt: null,
    selfConfirmedAt: null,
    generationsUsed: 0,
    bonusGranted: 0,
  };
}

export function newUserStripe(): User['stripe'] {
  return {
    accountId: null,
    customerId: null,
    defaultPaymentMethodId: null,
    payoutsEnabled: false,
    onboardingStartedAt: null,
    platformAccountId: null,
  };
}
