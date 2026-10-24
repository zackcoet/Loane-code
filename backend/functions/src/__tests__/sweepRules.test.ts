/**
 * The hourly sweep only touches a booking that is STILL in the state it
 * was listed in — so a yes, a cancel or a complaint that lands in the
 * same moment is never overwritten.
 *
 * Pure — no emulator needed.
 */

import { describe, expect, it } from 'vitest';
import { stillSettled, stillStale } from '../bookings/sweep';

const NOW = { toMillis: () => 1_000_000 };
const past = { seconds: 900, nanoseconds: 0 };
const future = { seconds: 1100, nanoseconds: 0 };

describe('a request the sweep may expire', () => {
  it('still waiting and out of time', () => {
    expect(stillStale({ status: 'requested', expiresAt: past }, NOW)).toBe(true);
  });
  it('not if the lender just said yes', () => {
    expect(stillStale({ status: 'confirmed', expiresAt: past }, NOW)).toBe(false);
  });
  it('not if the renter just cancelled', () => {
    expect(stillStale({ status: 'cancelled', expiresAt: past }, NOW)).toBe(false);
  });
  it('not before its deadline, or with none', () => {
    expect(stillStale({ status: 'requested', expiresAt: future }, NOW)).toBe(false);
    expect(stillStale({ status: 'requested', expiresAt: null }, NOW)).toBe(false);
  });
});

describe('a return the sweep may complete', () => {
  it('back and nobody complained in time', () => {
    expect(stillSettled({ status: 'returned', disputeWindowEndsAt: past }, NOW)).toBe(true);
  });
  it('not if she just flagged a problem', () => {
    expect(stillSettled({ status: 'disputed', disputeWindowEndsAt: past }, NOW)).toBe(false);
  });
  it('not if the lender already closed it by hand', () => {
    expect(stillSettled({ status: 'completed', disputeWindowEndsAt: null }, NOW)).toBe(false);
  });
  it('not while the window is still open', () => {
    expect(stillSettled({ status: 'returned', disputeWindowEndsAt: future }, NOW)).toBe(false);
  });
});
