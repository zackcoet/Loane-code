import {
  FULL_REFUND_CUTOFF_HOURS,
  LATE_CANCEL_LENDER_SHARE_BPS,
  LIABILITY_CAP_BPS,
  PLATFORM_FEE_BPS,
  PLATFORM_FEE_PAID_BY,
  SAME_DAY_PREMIUM_BPS,
} from './constants';
import type { Cents } from './types/common';

/**
 * Money helpers. Every amount in Loane is an integer number of US cents.
 * Floats are never allowed to touch money.
 */

/** "$45.00" */
export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

/** "$45" when whole, "$45.50" otherwise. Used in listing grids. */
export function formatCentsShort(cents: Cents): string {
  const abs = Math.abs(Math.round(cents));
  return abs % 100 === 0 ? `$${abs / 100}` : formatCents(cents);
}

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

/** Basis points of an amount, rounded to the nearest cent. */
export function applyBps(cents: Cents, bps: number): Cents {
  return Math.round((cents * bps) / 10_000);
}

export type FeePaidBy = 'renter' | 'lender' | 'split';

export interface FeeBreakdown {
  /** The rental or sale price on the listing. */
  baseCents: Cents;
  /**
   * The lender's optional cleaning charge. Passed through to her WHOLE —
   * it reimburses a real cost rather than being revenue, so Loane takes
   * no cut of it.
   */
  cleaningFeeCents: Cents;
  /** Paid to get the piece today. Splits 80/20 like the rental. */
  sameDayPremiumCents: Cents;
  /** Loane's cut. */
  platformFeeCents: Cents;
  /** What the renter is charged, all in. */
  renterTotalCents: Cents;
  /** What the lender receives. */
  lenderPayoutCents: Cents;
  /**
   * The most she can be charged later if a damage or non-return claim is
   * approved. Not held, not charged up front. See LIABILITY_CAP_BPS.
   */
  liabilityCapCents: Cents;
  feePaidBy: FeePaidBy;
}

export interface FeeInput {
  baseCents: Cents;
  garmentValueCents: Cents;
  /** Optional, set by the lender on the listing. */
  cleaningFeeCents?: Cents;
  /** True when she is asking for the piece today. */
  sameDay?: boolean;
  /**
   * The lender's own same-day premium, when she has set one. Null or
   * absent uses SAME_DAY_PREMIUM_BPS.
   */
  sameDayPremiumBps?: number | null;
  /** Overridable so a booking made under an old rule still adds up. */
  feePaidBy?: FeePaidBy;
}

/**
 * Work out who pays what.
 *
 * THE RENTER PAYS THE LISTED PRICE. There is no Loane line at checkout.
 * Loane's 20% comes out of what the lender receives, which is why
 * `renterTotalCents` does not include the platform fee.
 *
 * Two things are deliberately NOT treated the same:
 *
 *   cleaning fee     passed through to the lender whole. It reimburses a
 *                    dry-clean she actually pays for; taking a cut of a
 *                    cost is not a cut of revenue.
 *   same-day premium split 80/20 like the rental. She is being asked to
 *                    drop everything and drive, so she gets the bulk, but
 *                    it is genuinely extra earnings rather than a cost.
 *
 * `feePaidBy` still supports the old renter-pays and split rules, because
 * every booking stores its own breakdown and one made in September must
 * still reconcile today.
 */
export function calculateFees(input: FeeInput): FeeBreakdown {
  const {
    baseCents,
    garmentValueCents,
    cleaningFeeCents = 0,
    sameDay = false,
    sameDayPremiumBps = null,
    feePaidBy = PLATFORM_FEE_PAID_BY,
  } = input;

  const sameDayPremiumCents = sameDay
    ? applyBps(baseCents, sameDayPremiumBps ?? SAME_DAY_PREMIUM_BPS)
    : 0;

  // Everything Loane takes a cut of. Cleaning is excluded on purpose.
  const commissionable = baseCents + sameDayPremiumCents;
  const platformFeeCents = applyBps(commissionable, PLATFORM_FEE_BPS);
  const liabilityCapCents = applyBps(garmentValueCents, LIABILITY_CAP_BPS);

  let renterTotalCents: Cents;
  let lenderPayoutCents: Cents;

  switch (feePaidBy) {
    case 'lender':
      // Today's rule. She pays what the listing says, plus the lender's
      // own cleaning charge; the fee is invisible to her.
      renterTotalCents = commissionable + cleaningFeeCents;
      lenderPayoutCents = renterTotalCents - platformFeeCents;
      break;
    case 'renter':
      renterTotalCents = commissionable + cleaningFeeCents + platformFeeCents;
      lenderPayoutCents = commissionable + cleaningFeeCents;
      break;
    case 'split': {
      // The odd cent goes to the renter's side, deliberately and always,
      // so that renterTotal - lenderPayout === platformFee exactly.
      const half = Math.round(platformFeeCents / 2);
      renterTotalCents = commissionable + cleaningFeeCents + half;
      lenderPayoutCents = commissionable + cleaningFeeCents - (platformFeeCents - half);
      break;
    }
  }

  return {
    baseCents,
    cleaningFeeCents,
    sameDayPremiumCents,
    platformFeeCents,
    renterTotalCents,
    lenderPayoutCents,
    liabilityCapCents,
    feePaidBy,
  };
}

/**
 * The price for a given rental length.
 *
 * One place, because `days === 7 ? seven : three` was written in two
 * files and both would have quietly charged a one-day rental the
 * three-day price the moment that option existed.
 */
export function priceForDuration(
  pricing: { oneDayCents: Cents | null; threeDayCents: Cents | null; sevenDayCents: Cents | null },
  days: number,
): Cents | null {
  if (days === 1) return pricing.oneDayCents;
  if (days === 7) return pricing.sevenDayCents;
  if (days === 3) return pricing.threeDayCents;
  return null;
}

// ---------------------------------------------------------------------------
// Cancellations
// ---------------------------------------------------------------------------

export interface RefundBreakdown {
  /** Back to the renter. */
  refundCents: Cents;
  /** Kept by the lender as compensation for a late cancellation. */
  lenderKeepsCents: Cents;
  /** Loane's fee on a cancelled booking is always returned. */
  platformKeepsCents: Cents;
  reason: 'full' | 'late_cancel' | 'lender_cancelled' | 'not_captured';
}

/**
 * What happens to the money when a booking is cancelled.
 *
 * Pure arithmetic over the booking's own stored amounts, so the policy can
 * be tested without Stripe, Firestore or a clock. The caller supplies
 * `now` rather than reading the clock here, for the same reason.
 *
 * `captured` matters because Loane authorizes at request and captures at
 * pickup: before pickup there is no money to split, only a hold to release.
 */
export function calculateRefund(params: {
  amounts: Pick<
    FeeBreakdown,
    'baseCents' | 'platformFeeCents' | 'renterTotalCents'
  >;
  /** First day of the rental. Null for a purchase. */
  startDate: Date | null;
  cancelledBy: 'renter' | 'lender' | 'system';
  /** Has the renter's card actually been charged yet? */
  captured: boolean;
  now: Date;
}): RefundBreakdown {
  const { amounts, startDate, cancelledBy, captured, now } = params;

  // Nothing was ever taken, so there is nothing to divide. The caller
  // releases the authorization instead.
  if (!captured) {
    return {
      refundCents: 0,
      lenderKeepsCents: 0,
      platformKeepsCents: 0,
      reason: 'not_captured',
    };
  }

  const full = (
    reason: RefundBreakdown['reason'],
  ): RefundBreakdown => ({
    refundCents: amounts.renterTotalCents,
    lenderKeepsCents: 0,
    platformKeepsCents: 0,
    reason,
  });

  // A lender who backs out never costs the renter anything, no matter when.
  // Her side of it is that the cancellation is recorded against her.
  if (cancelledBy !== 'renter') return full('lender_cancelled');

  // No start date (a purchase), or cancelled with time to spare.
  if (!startDate) return full('full');
  const hoursUntilStart = (startDate.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntilStart >= FULL_REFUND_CUTOFF_HOURS) return full('full');

  // Late. The lender keeps her share of the RENTAL only; the Loane fee goes
  // back because we never keep a cut of a rental that did not happen.
  const lenderKeepsCents = applyBps(
    amounts.baseCents,
    LATE_CANCEL_LENDER_SHARE_BPS,
  );
  return {
    refundCents: amounts.renterTotalCents - lenderKeepsCents,
    lenderKeepsCents,
    platformKeepsCents: 0,
    reason: 'late_cancel',
  };
}
