import { formatShortDate, rangesOverlap, type Booking, type Listing } from '@loane/shared';

/**
 * Can the lender say yes to this request right now?
 *
 * Pure, so it can be tested without a database: `respondToBooking`
 * reads the piece and its holding bookings inside its transaction and
 * hands them here. Returns the message to show her, or null when
 * accepting is fine.
 *
 * Dates alone used to decide this, and a purchase has no dates — so a
 * lender could say yes to two buyers for one piece, sell a piece a
 * renter had already been promised, or confirm a rental on something
 * she had agreed to sell or had already sold. The rule is the one
 * `requestPurchase` already applies when a buyer first asks: a promise
 * already made wins, whichever kind it is.
 */
export function acceptClash(
  booking: Pick<Booking, 'id' | 'kind' | 'startDate' | 'endDate'>,
  listing: Pick<Listing, 'status'> | null,
  holding: Pick<Booking, 'id' | 'kind' | 'status' | 'startDate' | 'endDate'>[],
  today: string,
): string | null {
  // Paused still allows it: pausing hides a piece from new people, it
  // does not take back a request she already has in hand.
  if (!listing || listing.status === 'removed' || listing.status === 'suspended') {
    return 'That piece is no longer listed.';
  }
  if (listing.status === 'sold') return 'That piece has already been sold.';

  const others = holding.filter((b) => b.id !== booking.id);

  if (others.some((b) => b.kind === 'purchase')) {
    return 'You already agreed to sell this piece to someone else.';
  }

  if (booking.kind === 'purchase') {
    // Any rental still to come, or one she is holding right now (even
    // if it is late back), means the piece is not hers to hand over.
    const out = others
      .filter(
        (b) => b.kind === 'rental' && (b.status === 'with_renter' || (b.endDate ?? '') > today),
      )
      .sort((a, b) => ((a.endDate ?? '') < (b.endDate ?? '') ? 1 : -1))[0];
    if (out) {
      return out.endDate && out.endDate > today
        ? `It's on Loane until ${formatShortDate(out.endDate)}, so you can't sell it yet.`
        : "It's on Loane right now, so you can't sell it yet.";
    }
    return null;
  }

  if (!booking.startDate || !booking.endDate) return null;
  const clash = others.some(
    (b) =>
      b.kind === 'rental' &&
      b.startDate &&
      b.endDate &&
      rangesOverlap(
        { startDate: booking.startDate!, endDate: booking.endDate! },
        { startDate: b.startDate, endDate: b.endDate },
      ),
  );
  return clash ? 'You already confirmed someone else for those dates.' : null;
}
