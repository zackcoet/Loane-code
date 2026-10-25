import {
  formatShortDate,
  newBookingPayment,
  type Booking,
  type Listing,
  type User,
  type UserSummary,
} from '@loane/shared';

/**
 * The pure parts of Own It, kept apart so they can be tested without a
 * database. `requestPurchase` reads, these decide and shape.
 */

/**
 * Is a rental in the way of buying this piece?
 *
 * Any rental still to come, or one a girl is holding right now — even
 * late back — means the piece is not the seller's to hand over. Before,
 * only rentals with an end date still ahead counted, so a buyer could ask
 * for a piece that was overdue with a renter; the seller then could never
 * say yes (accepting already refused it) and the buyer waited a day for
 * nothing. Same rule as `acceptClash`, worded for the buyer.
 */
export function purchaseRentalClash(
  holding: Pick<Booking, 'kind' | 'status' | 'endDate'>[],
  today: string,
): string | null {
  const out = holding
    .filter((b) => b.kind === 'rental' && (b.status === 'with_renter' || (b.endDate ?? '') > today))
    .sort((a, b) => ((a.endDate ?? '') < (b.endDate ?? '') ? 1 : -1))[0];
  if (!out) return null;
  // The date, not just a refusal — it tells her whether waiting is worth it.
  return out.endDate && out.endDate > today
    ? `On Loane until ${formatShortDate(out.endDate)}.`
    : 'On Loane right now.';
}

/** The short copy of a person every booking carries. */
export function personSummary(u: User): UserSummary {
  return {
    uid: u.uid,
    username: u.username,
    displayName: u.displayName,
    photoUrl: u.photoUrl,
    campusId: u.campusId,
    isVerified: u.isVerified,
  };
}

/**
 * A purchase request, in the SAME shape as a rental request.
 *
 * It used to be written loosely and forced past the type checker, and it
 * had drifted: no `timeline`, a drop-off block missing `notes`, the
 * cancel fields under different names than every other booking, and the
 * piece's summary under `id` instead of `listingId`. The first of those
 * broke a real step — recording a drop-off on a sale without a note
 * failed with "Something went wrong". Typed as a Booking now, so the
 * compiler catches the next drift.
 */
export function newPurchaseBooking(params: {
  id: string;
  listing: Listing;
  seller: User;
  buyer: User;
  message: string;
  amounts: Booking['amounts'];
  expiresAt: Booking['expiresAt'];
  requestedAt: Booking['timeline']['requestedAt'];
}): Omit<Booking, 'createdAt' | 'updatedAt'> {
  const { id, listing, seller, buyer } = params;
  return {
    id,
    kind: 'purchase',
    status: 'requested',
    campusId: listing.campusId,
    listingId: listing.id,
    listing: {
      listingId: listing.id,
      name: listing.name,
      coverUrl: listing.coverUrl,
      ownerUid: listing.ownerUid,
      priceCents3Day: listing.pricing?.threeDayCents ?? null,
      salePriceCents: listing.salePriceCents,
    },
    lenderUid: listing.ownerUid,
    lender: personSummary(seller),
    renterUid: buyer.uid,
    renter: personSummary(buyer),
    // No dates. A purchase is not a span of time.
    startDate: null,
    endDate: null,
    durationDays: null,
    amounts: params.amounts,
    payment: newBookingPayment(),
    renterMessage: params.message.trim() || null,
    handoff: {
      notes: null,
      dropoffPhotos: [],
      dropoffAt: null,
      renterConfirmedReceiptAt: null,
      returnPhotos: [],
      renterConfirmedReturnAt: null,
      lenderConfirmedReturnAt: null,
    },
    timeline: {
      requestedAt: params.requestedAt,
      respondedAt: null,
      confirmedAt: null,
      cancelledAt: null,
      completedAt: null,
    },
    cancelledByUid: null,
    cancellationReason: null,
    declineReason: null,
    expiresAt: params.expiresAt,
    disputeWindowEndsAt: null,
    returnProblem: null,
    disputeResolution: null,
    activeClaimId: null,
    reviews: { lenderReviewId: null, renterReviewId: null },
  };
}
