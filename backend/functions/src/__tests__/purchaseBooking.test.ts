/**
 * Own It's pure parts — no database needed.
 *
 *   - A rental in the way of a sale, including one late back.
 *   - A purchase request has the same shape as a rental request.
 *   - Notes on a rental are text, and not too long.
 */

import { describe, expect, it } from 'vitest';
import { LIMITS, addDays, type Listing, type User } from '@loane/shared';
import { newPurchaseBooking, purchaseRentalClash } from '../bookings/purchaseBooking';
import { checkNote } from '../bookings/note';

const TODAY = '2026-10-25';

describe('purchaseRentalClash', () => {
  it('lets a sale through with nothing in the way', () => {
    expect(purchaseRentalClash([], TODAY)).toBeNull();
  });

  it('names the day a rental still to come ends', () => {
    expect(
      purchaseRentalClash(
        [{ kind: 'rental', status: 'confirmed', endDate: addDays(TODAY, 5) }],
        TODAY,
      ),
    ).toMatch(/^On Loane until /);
  });

  it('refuses while a girl still has it, even late back', () => {
    expect(
      purchaseRentalClash(
        [{ kind: 'rental', status: 'with_renter', endDate: addDays(TODAY, -2) }],
        TODAY,
      ),
    ).toBe('On Loane right now.');
  });

  it('ignores a rental that ended and is not with her', () => {
    expect(
      purchaseRentalClash([{ kind: 'rental', status: 'disputed', endDate: TODAY }], TODAY),
    ).toBeNull();
  });

  it('picks the latest end date when there are several', () => {
    const msg = purchaseRentalClash(
      [
        { kind: 'rental', status: 'confirmed', endDate: addDays(TODAY, 3) },
        { kind: 'rental', status: 'confirmed', endDate: addDays(TODAY, 9) },
      ],
      TODAY,
    );
    expect(msg).toContain('Nov 3');
  });
});

describe('newPurchaseBooking', () => {
  const person = (uid: string, username: string) =>
    ({
      uid,
      username,
      displayName: username,
      photoUrl: null,
      campusId: 'university-of-south-carolina',
      isVerified: true,
      // Profile fields that must NOT leak onto the booking.
      bio: 'secret-ish',
    }) as unknown as User;

  const listing = {
    id: 'listing-1',
    ownerUid: 'seller',
    campusId: 'university-of-south-carolina',
    name: 'Black lace top',
    coverUrl: null,
    pricing: { threeDayCents: 2500 },
    salePriceCents: 4000,
  } as unknown as Listing;

  const booking = newPurchaseBooking({
    id: 'b1',
    listing,
    seller: person('seller', 'ella'),
    buyer: person('buyer', 'harper'),
    message: '  can we meet at the library?  ',
    amounts: {
      baseCents: 4000,
      cleaningFeeCents: 0,
      sameDayPremiumCents: 0,
      platformFeeCents: 800,
      renterTotalCents: 4000,
      lenderPayoutCents: 3200,
      liabilityCapCents: 0,
      feePaidBy: 'lender',
    },
    expiresAt: null,
    requestedAt: null,
  });

  it('has every field a drop-off and a cancel write to', () => {
    expect(booking.handoff.notes).toBeNull();
    expect(booking.handoff.dropoffPhotos).toEqual([]);
    expect(booking.timeline.cancelledAt).toBeNull();
    expect(booking.cancelledByUid).toBeNull();
    expect(booking.cancellationReason).toBeNull();
    expect('cancelledBy' in booking).toBe(false);
  });

  it('is a dateless purchase from the seller to the buyer', () => {
    expect(booking.kind).toBe('purchase');
    expect(booking.status).toBe('requested');
    expect(booking.startDate).toBeNull();
    expect(booking.lenderUid).toBe('seller');
    expect(booking.renterUid).toBe('buyer');
    expect(booking.listing.listingId).toBe('listing-1');
    expect(booking.listing.salePriceCents).toBe(4000);
  });

  it('copies only the short summary of each person', () => {
    expect(booking.renter).toEqual({
      uid: 'buyer',
      username: 'harper',
      displayName: 'harper',
      photoUrl: null,
      campusId: 'university-of-south-carolina',
      isVerified: true,
    });
    expect(booking.lender.username).toBe('ella');
  });

  it('trims her message, and an empty one is none', () => {
    expect(booking.renterMessage).toBe('can we meet at the library?');
    const quiet = newPurchaseBooking({
      id: 'b2',
      listing,
      seller: person('seller', 'ella'),
      buyer: person('buyer', 'harper'),
      message: '   ',
      amounts: booking.amounts,
      expiresAt: null,
      requestedAt: null,
    });
    expect(quiet.renterMessage).toBeNull();
  });
});

describe('checkNote', () => {
  it('treats nothing as an empty note', () => {
    expect(checkNote(undefined)).toBe('');
    expect(checkNote(null)).toBe('');
  });

  it('keeps ordinary text', () => {
    expect(checkNote('see you at 5')).toBe('see you at 5');
  });

  it('refuses anything that is not text', () => {
    expect(() => checkNote(42)).toThrow('That note is not text.');
    expect(() => checkNote({ a: 1 })).toThrow('That note is not text.');
  });

  it('refuses a note over the limit', () => {
    expect(() => checkNote('x'.repeat(LIMITS.bookingNote.max + 1))).toThrow(/Keep it under/);
    expect(checkNote('x'.repeat(LIMITS.bookingNote.max))).toHaveLength(LIMITS.bookingNote.max);
  });
});
