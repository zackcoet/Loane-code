import { describe, expect, it } from 'vitest';
import {
  applyBps,
  calculateFees,
  calculateRefund,
  dollarsToCents,
  formatCents,
  formatCentsShort,
} from '../money';
import {
  LATE_CANCEL_LENDER_SHARE_BPS,
  PLATFORM_FEE_BPS,
  PLATFORM_FEE_MINIMUM_CENTS,
} from '../constants';

/**
 * Money math. Pure arithmetic, no emulator needed.
 *
 * The invariant that matters most is the last block: whatever the split,
 * what the renter pays minus what the lender gets must equal Loane's fee,
 * exactly, in whole cents. A rounding error here is money appearing or
 * vanishing from a real person's bank account.
 */

const $ = dollarsToCents;

describe('formatting', () => {
  it('formats whole and partial dollars', () => {
    expect(formatCents(4500)).toBe('$45.00');
    expect(formatCents(4550)).toBe('$45.50');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(-500)).toBe('-$5.00');
  });

  it('drops trailing zeroes in the short form', () => {
    expect(formatCentsShort(4500)).toBe('$45');
    expect(formatCentsShort(4550)).toBe('$45.50');
  });

  it('converts dollars without float drift', () => {
    // 0.1 + 0.2 territory. 19.99 * 100 is 1998.9999... in binary.
    expect($(19.99)).toBe(1999);
    expect($(0.07)).toBe(7);
    expect($(35.35)).toBe(3535);
  });
});

describe('applyBps', () => {
  it('rounds to the nearest cent', () => {
    expect(applyBps(3500, 1500)).toBe(525);
    // 1000 * 15% = 150 exactly.
    expect(applyBps(1000, 1500)).toBe(150);
    // 333 * 15% = 49.95 -> 50.
    expect(applyBps(333, 1500)).toBe(50);
  });
});

describe('calculateFees — the decided policy', () => {
  it('charges the renter 15% on top and pays the lender her full price', () => {
    const f = calculateFees($(35), $(200));
    expect(f.baseCents).toBe(3500);
    expect(f.platformFeeCents).toBe(525);
    expect(f.renterTotalCents).toBe(4025);
    expect(f.lenderPayoutCents).toBe(3500);
    expect(f.feePaidBy).toBe('renter');
  });

  it('defaults to the renter paying', () => {
    expect(calculateFees($(35), $(200)).feePaidBy).toBe('renter');
    expect(PLATFORM_FEE_BPS).toBe(1500);
  });

  it('sets the liability cap to the full documented garment value', () => {
    expect(calculateFees($(35), $(200)).liabilityCapCents).toBe(20000);
  });

  it('never holds anything — the cap is not part of what she pays', () => {
    const f = calculateFees($(35), $(200));
    expect(f.renterTotalCents).toBe(f.baseCents + f.platformFeeCents);
    expect(f.renterTotalCents).toBeLessThan(f.liabilityCapCents);
  });
});

describe('calculateFees — the minimum fee', () => {
  it('applies the floor when the percentage is smaller', () => {
    // $5 * 15% = 75c, below the 150c floor.
    const f = calculateFees($(5), $(40));
    expect(f.platformFeeCents).toBe(PLATFORM_FEE_MINIMUM_CENTS);
    expect(f.renterTotalCents).toBe(650);
  });

  it('does not apply the floor once the percentage exceeds it', () => {
    // $10 * 15% = 150c, exactly the floor.
    expect(calculateFees($(10), $(40)).platformFeeCents).toBe(150);
    // $11 * 15% = 165c, above it.
    expect(calculateFees($(11), $(40)).platformFeeCents).toBe(165);
  });

  it('never charges a fee larger than the rental itself', () => {
    // A $1 piece must not carry a $1.50 fee.
    const f = calculateFees($(1), $(10));
    expect(f.platformFeeCents).toBe(100);
    expect(f.renterTotalCents).toBe(200);
    expect(f.lenderPayoutCents).toBe(100);
  });

  it('handles a free item without going negative', () => {
    const f = calculateFees(0, $(10));
    expect(f.platformFeeCents).toBe(0);
    expect(f.renterTotalCents).toBe(0);
    expect(f.lenderPayoutCents).toBe(0);
  });
});

describe('calculateFees — the other splits still add up', () => {
  it('lender-pays takes the fee out of the payout', () => {
    const f = calculateFees($(35), $(200), 'lender');
    expect(f.renterTotalCents).toBe(3500);
    expect(f.lenderPayoutCents).toBe(2975);
  });

  it('split halves it, odd cent to the renter', () => {
    // $33.33 * 15% = 499.95 -> 500c. Half is 250 each, even.
    const even = calculateFees(3333, $(200), 'split');
    expect(even.platformFeeCents).toBe(500);
    expect(even.renterTotalCents).toBe(3583);
    expect(even.lenderPayoutCents).toBe(3083);

    // 1007c * 15% = 151.05 -> 151c, which is odd and clears the 150c floor.
    // (A smaller base would be lifted to the floor and never test the halving.)
    const odd = calculateFees(1007, $(200), 'split');
    expect(odd.platformFeeCents).toBe(151);
    expect(odd.renterTotalCents).toBe(1007 + 76);
    expect(odd.lenderPayoutCents).toBe(1007 - 75);
  });

  it('conserves money for every split at every price', () => {
    const splits = ['renter', 'lender', 'split'] as const;
    for (let base = 0; base <= 50_000; base += 7) {
      for (const feePaidBy of splits) {
        const f = calculateFees(base, $(200), feePaidBy);
        // The money Loane keeps is exactly the gap between the two sides.
        expect(f.renterTotalCents - f.lenderPayoutCents).toBe(
          f.platformFeeCents,
        );
        // And nothing is ever a fraction of a cent.
        expect(Number.isInteger(f.platformFeeCents)).toBe(true);
        expect(Number.isInteger(f.renterTotalCents)).toBe(true);
        expect(Number.isInteger(f.lenderPayoutCents)).toBe(true);
        expect(f.lenderPayoutCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('calculateRefund', () => {
  const amounts = { baseCents: 3500, platformFeeCents: 525, renterTotalCents: 4025 };
  const start = new Date('2026-10-10T00:00:00Z');

  it('returns nothing to split before the card is captured', () => {
    const r = calculateRefund({
      amounts,
      startDate: start,
      cancelledBy: 'renter',
      captured: false,
      now: new Date('2026-10-09T12:00:00Z'),
    });
    expect(r.reason).toBe('not_captured');
    expect(r.refundCents).toBe(0);
    expect(r.lenderKeepsCents).toBe(0);
  });

  it('refunds everything when she cancels with time to spare', () => {
    const r = calculateRefund({
      amounts,
      startDate: start,
      cancelledBy: 'renter',
      captured: true,
      // Four days out.
      now: new Date('2026-10-06T00:00:00Z'),
    });
    expect(r.reason).toBe('full');
    expect(r.refundCents).toBe(4025);
    expect(r.lenderKeepsCents).toBe(0);
  });

  it('treats exactly 48 hours as still in time', () => {
    const r = calculateRefund({
      amounts,
      startDate: start,
      cancelledBy: 'renter',
      captured: true,
      now: new Date('2026-10-08T00:00:00Z'),
    });
    expect(r.reason).toBe('full');
  });

  it('gives the lender half the rental on a late cancel, fee refunded', () => {
    const r = calculateRefund({
      amounts,
      startDate: start,
      cancelledBy: 'renter',
      captured: true,
      // One day out.
      now: new Date('2026-10-09T00:00:00Z'),
    });
    expect(r.reason).toBe('late_cancel');
    expect(r.lenderKeepsCents).toBe(1750);
    // She gets her fee back plus the half she is not forfeiting.
    expect(r.refundCents).toBe(4025 - 1750);
    expect(r.platformKeepsCents).toBe(0);
    expect(LATE_CANCEL_LENDER_SHARE_BPS).toBe(5000);
  });

  it('refunds the renter in full whenever the lender backs out', () => {
    for (const now of [
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-09T23:00:00Z'),
    ]) {
      const r = calculateRefund({
        amounts,
        startDate: start,
        cancelledBy: 'lender',
        captured: true,
        now,
      });
      expect(r.reason).toBe('lender_cancelled');
      expect(r.refundCents).toBe(4025);
      expect(r.lenderKeepsCents).toBe(0);
    }
  });

  it('never keeps a Loane fee on a cancelled booking', () => {
    for (const cancelledBy of ['renter', 'lender', 'system'] as const) {
      const r = calculateRefund({
        amounts,
        startDate: start,
        cancelledBy,
        captured: true,
        now: new Date('2026-10-09T00:00:00Z'),
      });
      expect(r.platformKeepsCents).toBe(0);
    }
  });

  it('refunds a purchase in full — there is no start date to be late for', () => {
    const r = calculateRefund({
      amounts,
      startDate: null,
      cancelledBy: 'renter',
      captured: true,
      now: new Date('2026-10-09T00:00:00Z'),
    });
    expect(r.reason).toBe('full');
    expect(r.refundCents).toBe(4025);
  });

  it('never refunds more than was taken', () => {
    for (const cancelledBy of ['renter', 'lender'] as const) {
      for (let hours = 0; hours < 200; hours += 3) {
        const r = calculateRefund({
          amounts,
          startDate: start,
          cancelledBy,
          captured: true,
          now: new Date(start.getTime() - hours * 3_600_000),
        });
        expect(r.refundCents + r.lenderKeepsCents + r.platformKeepsCents).toBe(
          amounts.renterTotalCents,
        );
        expect(r.refundCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
