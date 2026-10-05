import {
  FULL_REFUND_CUTOFF_HOURS,
  LATE_CANCEL_LENDER_SHARE_BPS,
  LIABILITY_CAP_BPS,
  PLATFORM_FEE_BPS,
  PLATFORM_FEE_MINIMUM_CENTS,
  PLATFORM_FEE_PAID_BY,
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
  baseCents: Cents;
  platformFeeCents: Cents;
  renterTotalCents: Cents;
  lenderPayoutCents: Cents;
  /**
   * The most she can be charged later if a damage or non-return claim is
   * approved. Not held, not charged up front. See LIABILITY_CAP_BPS.
   */
  liabilityCapCents: Cents;
  feePaidBy: FeePaidBy;
}

/**
 * Work out who pays what for a booking.
 *
 * Decided in Phase 5: the renter pays the fee on top, and the lender
 * receives exactly the price she listed. The other two splits stay
 * implemented because each booking stores its own `feePaidBy`, so a
 * booking made under a different rule must still add up years later.
 */
export function calculateFees(
  baseCents: Cents,
  garmentValueCents: Cents,
  feePaidBy: FeePaidBy = PLATFORM_FEE_PAID_BY,
): FeeBreakdown {
  // The minimum exists to cover Stripe's flat 30c on small rentals, but it
  // must never exceed the rental itself — a $1 item would otherwise carry a
  // $1.50 fee.
  const platformFeeCents = Math.min(
    baseCents,
    Math.max(applyBps(baseCents, PLATFORM_FEE_BPS), PLATFORM_FEE_MINIMUM_CENTS),
  );

  const liabilityCapCents = applyBps(garmentValueCents, LIABILITY_CAP_BPS);

  let renterTotalCents: Cents;
  let lenderPayoutCents: Cents;

  switch (feePaidBy) {
    case 'renter':
      renterTotalCents = baseCents + platformFeeCents;
      lenderPayoutCents = baseCents;
      break;
    case 'lender':
      renterTotalCents = baseCents;
      lenderPayoutCents = baseCents - platformFeeCents;
      break;
    case 'split': {
      // The odd cent goes to the renter's side, deliberately and always, so
      // that renterTotal - fee === lenderPayout holds exactly.
      const half = Math.round(platformFeeCents / 2);
      renterTotalCents = baseCents + half;
      lenderPayoutCents = baseCents - (platformFeeCents - half);
      break;
    }
  }

  return {
    baseCents,
    platformFeeCents,
    renterTotalCents,
    lenderPayoutCents,
    liabilityCapCents,
    feePaidBy,
  };
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
