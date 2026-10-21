import { describe, expect, it } from 'vitest';
import {
  applyBps,
  calculateFees,
  calculateRefund,
  dollarsToCents,
  formatCents,
  formatCentsShort,
  priceForDuration,
} from '../money';
import { LATE_CANCEL_LENDER_SHARE_BPS, PLATFORM_FEE_BPS, RENTAL_DURATIONS } from '../constants';

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
    expect(applyBps(3500, 2000)).toBe(700);
    // 1000 * 20% = 200 exactly.
    expect(applyBps(1000, 2000)).toBe(200);
    // 333 * 20% = 66.6 -> 67.
    expect(applyBps(333, 2000)).toBe(67);
  });
});

describe('calculateFees — the decided policy', () => {
  it('charges the renter the listed price and nothing else', () => {
    const f = calculateFees({ baseCents: $(35), garmentValueCents: $(200) });
    expect(f.baseCents).toBe(3500);
    // The whole point of the Depop model: no Loane line at checkout.
    expect(f.renterTotalCents).toBe(3500);
    expect(f.feePaidBy).toBe('lender');
  });

  it('takes 20% out of what the lender receives', () => {
    const f = calculateFees({ baseCents: $(35), garmentValueCents: $(200) });
    expect(f.platformFeeCents).toBe(700);
    expect(f.lenderPayoutCents).toBe(2800);
  });

  it('defaults to the lender paying', () => {
    expect(calculateFees({ baseCents: $(35), garmentValueCents: $(200) }).feePaidBy).toBe('lender');
    expect(PLATFORM_FEE_BPS).toBe(2000);
  });

  it('sets the liability cap to the full documented garment value', () => {
    expect(calculateFees({ baseCents: $(35), garmentValueCents: $(200) }).liabilityCapCents).toBe(
      20000,
    );
  });

  it('has no minimum fee, so a cheap rental is not gouged', () => {
    const f = calculateFees({ baseCents: $(5), garmentValueCents: $(40) });
    expect(f.platformFeeCents).toBe(100);
    expect(f.lenderPayoutCents).toBe(400);
    expect(f.renterTotalCents).toBe(500);
  });

  it('handles a free item without going negative', () => {
    const f = calculateFees({ baseCents: 0, garmentValueCents: $(10) });
    expect(f.platformFeeCents).toBe(0);
    expect(f.renterTotalCents).toBe(0);
    expect(f.lenderPayoutCents).toBe(0);
  });
});

describe('calculateFees — the cleaning fee passes through whole', () => {
  it('adds it to what the renter pays', () => {
    const f = calculateFees({
      baseCents: $(35),
      garmentValueCents: $(200),
      cleaningFeeCents: $(8),
    });
    expect(f.cleaningFeeCents).toBe(800);
    expect(f.renterTotalCents).toBe(4300);
  });

  it('takes NO commission on it', () => {
    const plain = calculateFees({ baseCents: $(35), garmentValueCents: $(200) });
    const cleaned = calculateFees({
      baseCents: $(35),
      garmentValueCents: $(200),
      cleaningFeeCents: $(8),
    });
    // The fee is identical; the lender simply receives $8 more.
    expect(cleaned.platformFeeCents).toBe(plain.platformFeeCents);
    expect(cleaned.lenderPayoutCents).toBe(plain.lenderPayoutCents + 800);
  });

  it('gives the lender every cent of it', () => {
    const f = calculateFees({
      baseCents: $(35),
      garmentValueCents: $(200),
      cleaningFeeCents: $(8),
    });
    expect(f.lenderPayoutCents).toBe(2800 + 800);
  });
});

describe('calculateFees — same-day splits like the rental', () => {
  it('adds 25% of the rental to what she pays', () => {
    const f = calculateFees({ baseCents: $(35), garmentValueCents: $(200), sameDay: true });
    expect(f.sameDayPremiumCents).toBe(875);
    expect(f.renterTotalCents).toBe(3500 + 875);
  });

  it('commissions the premium at the same 20%', () => {
    const f = calculateFees({ baseCents: $(35), garmentValueCents: $(200), sameDay: true });
    expect(f.platformFeeCents).toBe(875);
    expect(f.lenderPayoutCents).toBe(4375 - 875);
  });

  it('is zero when she is not in a hurry', () => {
    expect(calculateFees({ baseCents: $(35), garmentValueCents: $(200) }).sameDayPremiumCents).toBe(
      0,
    );
  });

  it('stacks with a cleaning fee, commissioning only the right part', () => {
    const f = calculateFees({
      baseCents: $(35),
      garmentValueCents: $(200),
      cleaningFeeCents: $(8),
      sameDay: true,
    });
    expect(f.renterTotalCents).toBe(3500 + 875 + 800);
    // 20% of rental + premium, never of the cleaning.
    expect(f.platformFeeCents).toBe(875);
    expect(f.lenderPayoutCents).toBe(3500 + 875 + 800 - 875);
  });
});

describe('calculateFees — the old rules still reconcile', () => {
  it('renter-pays adds the fee on top, as it did in September', () => {
    const f = calculateFees({
      baseCents: $(35),
      garmentValueCents: $(200),
      feePaidBy: 'renter',
    });
    expect(f.renterTotalCents).toBe(3500 + 700);
    expect(f.lenderPayoutCents).toBe(3500);
  });

  it('split halves it, odd cent to the renter', () => {
    // 701c * 20% = 140.2 -> 140c, even. 703c * 20% = 140.6 -> 141c, odd.
    const odd = calculateFees({
      baseCents: 703,
      garmentValueCents: $(200),
      feePaidBy: 'split',
    });
    expect(odd.platformFeeCents).toBe(141);
    expect(odd.renterTotalCents).toBe(703 + 71);
    expect(odd.lenderPayoutCents).toBe(703 - 70);
  });

  it('conserves money for every rule at every price', () => {
    const rules = ['lender', 'renter', 'split'] as const;
    for (let base = 0; base <= 50_000; base += 7) {
      for (const feePaidBy of rules) {
        for (const sameDay of [false, true]) {
          for (const cleaningFeeCents of [0, 800]) {
            const f = calculateFees({
              baseCents: base,
              garmentValueCents: $(200),
              cleaningFeeCents,
              sameDay,
              feePaidBy,
            });
            // Loane keeps exactly the gap between the two sides.
            expect(f.renterTotalCents - f.lenderPayoutCents).toBe(f.platformFeeCents);
            // Nothing is ever a fraction of a cent.
            expect(Number.isInteger(f.platformFeeCents)).toBe(true);
            expect(Number.isInteger(f.renterTotalCents)).toBe(true);
            expect(Number.isInteger(f.lenderPayoutCents)).toBe(true);
            expect(f.lenderPayoutCents).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
    // About 85,000 cases. Fast on a laptop, but slower machines (CI, the
    // overnight runner) went past vitest's 5-second default.
  }, 60_000);
});

describe('priceForDuration', () => {
  const pricing = { oneDayCents: 1200, threeDayCents: 1800, sevenDayCents: 2800 };

  it('returns the price for each supported length', () => {
    expect(priceForDuration(pricing, 1)).toBe(1200);
    expect(priceForDuration(pricing, 3)).toBe(1800);
    expect(priceForDuration(pricing, 7)).toBe(2800);
  });

  it('never silently falls back to another length', () => {
    // The bug this helper exists to prevent: a 1-day rental charged the
    // 3-day price because the old code was `days === 7 ? seven : three`.
    expect(priceForDuration(pricing, 2)).toBeNull();
    expect(priceForDuration(pricing, 0)).toBeNull();
    expect(priceForDuration(pricing, 30)).toBeNull();
  });

  it('passes a missing price through as null', () => {
    expect(priceForDuration({ ...pricing, oneDayCents: null }, 1)).toBeNull();
  });

  it('covers every duration the app offers', () => {
    for (const days of RENTAL_DURATIONS) {
      expect(priceForDuration(pricing, days)).not.toBeNull();
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
    for (const now of [new Date('2026-10-01T00:00:00Z'), new Date('2026-10-09T23:00:00Z')]) {
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
