import { PLATFORM_FEE_BPS, PROTECTION_HOLD_BPS } from './constants';
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

export interface FeeBreakdown {
  baseCents: Cents;
  platformFeeCents: Cents;
  renterTotalCents: Cents;
  lenderPayoutCents: Cents;
  protectionHoldCents: Cents;
  feePaidBy: 'renter' | 'lender' | 'split';
}

/**
 * Work out who pays what for a booking.
 *
 * TODO-DECIDE (Phase 5): `feePaidBy` defaults to "renter" — the fee is added
 * on top of the rental price and the lender receives the full base amount.
 * Zack has not decided this yet, so the result is written onto the booking
 * document, meaning a later change never rewrites past bookings.
 */
export function calculateFees(
  baseCents: Cents,
  garmentValueCents: Cents,
  feePaidBy: FeeBreakdown['feePaidBy'] = 'renter',
): FeeBreakdown {
  const platformFeeCents = applyBps(baseCents, PLATFORM_FEE_BPS);
  const protectionHoldCents = applyBps(garmentValueCents, PROTECTION_HOLD_BPS);

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
    protectionHoldCents,
    feePaidBy,
  };
}
