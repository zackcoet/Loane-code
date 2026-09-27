import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import type { Booking, DateRange, Listing, User } from '@loane/shared';
import {
  BLOCKING_BOOKING_STATUSES,
  COLLECTIONS,
  REQUEST_EXPIRY_HOURS,
  calculateFees,
  daysBetween,
  rangeHitsBlackout,
  rangesOverlap,
  toIsoDate,
  validateDateRange,
} from '@loane/shared';
import { db, now, Timestamp } from '../lib/admin';
import { alreadyTaken, failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { assertNotBlocked } from '../moderation/block';

/**
 * `requestBooking`
 *
 * THE function that makes double-booking impossible.
 *
 * The app never writes to the `bookings` collection — the security rules
 * forbid it outright. It calls this instead, and this runs the whole check
 * inside a Firestore transaction:
 *
 *   1. Read the listing. Is it active and rentable?
 *   2. Read every booking for that listing whose status blocks the calendar.
 *   3. Does any of them overlap the requested dates? If so, stop.
 *   4. Is any requested day blacked out by the owner? If so, stop.
 *   5. Create the booking.
 *
 * Because it is a transaction, two people tapping "request" for the same
 * dress on the same gameday weekend at the same instant cannot both
 * succeed. One wins; the other's transaction notices the world changed,
 * retries, sees the conflict at step 3, and gets a clear message.
 *
 * Note that a `requested` booking does NOT block the calendar — only a
 * confirmed one does. A lender can receive three requests for one weekend
 * and choose between them.
 */

interface RequestBookingInput {
  listingId: string;
  /** Inclusive first day she has it. */
  startDate: string;
  /** The day it comes back. The item is free again on this day. */
  endDate: string;
  message?: string;
}

interface RequestBookingResult {
  bookingId: string;
  status: Booking['status'];
}

/**
 * When an unanswered request goes stale: 48 hours from now, or the day
 * before the rental starts, whichever comes first. A request for this
 * Saturday should not sit unanswered until Saturday.
 */
function requestExpiry(startDate: string): Date {
  const in48h = new Date(Date.now() + REQUEST_EXPIRY_HOURS * 3600_000);
  const dayBeforeStart = new Date(`${startDate}T00:00:00Z`);
  dayBeforeStart.setUTCDate(dayBeforeStart.getUTCDate() - 1);
  return in48h < dayBeforeStart ? in48h : dayBeforeStart;
}

export const requestBooking = onCall<RequestBookingInput, Promise<RequestBookingResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<RequestBookingInput>): Promise<RequestBookingResult> => {
    const renter = await requireVerifiedStudent(request);
    const { listingId, startDate, endDate, message } = request.data ?? {};

    if (!listingId) throw invalidArgument('Pick an item to rent.');

    const range: DateRange = { startDate, endDate };
    const dateCheck = validateDateRange(range, toIsoDate(new Date()));
    if (!dateCheck.ok) throw invalidArgument(dateCheck.error!);

    const listingSnapForBlock = await db().collection(COLLECTIONS.listings).doc(listingId).get();
    if (listingSnapForBlock.exists) {
      await assertNotBlocked(
        renter.uid,
        (listingSnapForBlock.data() as { ownerUid: string }).ownerUid,
      );
    }

    const listingRef = db().collection(COLLECTIONS.listings).doc(listingId);
    const bookingRef = db().collection(COLLECTIONS.bookings).doc();

    const status = await db().runTransaction(async (tx) => {
      // --- 1. The listing --------------------------------------------------
      const listingSnap = await tx.get(listingRef);
      if (!listingSnap.exists) throw notFound('That piece is no longer listed.');

      const listing = listingSnap.data() as Listing;

      if (listing.status !== 'active') throw failed('That piece is not available right now.');
      if (listing.intent === 'sell') throw failed('That piece is for sale, not for rent.');
      if (listing.ownerUid === renter.uid) throw failed("That's your own listing.");
      if (listing.campusId !== renter.campusId) {
        throw failed('You can only rent from closets on your own campus.');
      }

      // --- 2 & 3. Conflicting bookings -------------------------------------
      // Read inside the transaction so anything written between now and
      // commit forces a retry.
      const conflictQuery = db()
        .collection(COLLECTIONS.bookings)
        .where('listingId', '==', listingId)
        .where('status', 'in', BLOCKING_BOOKING_STATUSES as string[]);

      const existing = await tx.get(conflictQuery);

      const clash = existing.docs.some((doc) => {
        const b = doc.data() as Booking;
        if (!b.startDate || !b.endDate) return false;
        return rangesOverlap(range, { startDate: b.startDate, endDate: b.endDate });
      });

      if (clash) {
        throw alreadyTaken('Those dates were just taken. Try different ones.');
      }

      // --- 4. Owner blackout dates -----------------------------------------
      if (rangeHitsBlackout(range, listing.blackoutDates ?? [])) {
        throw alreadyTaken('The owner has those dates blocked. Try different ones.');
      }

      // --- 5. Price and create ---------------------------------------------
      const durationDays = daysBetween(startDate, endDate);
      const baseCents =
        durationDays === 7 ? listing.pricing.sevenDayCents : listing.pricing.threeDayCents;

      if (baseCents == null) {
        throw failed(`This piece isn't available for ${durationDays} days.`);
      }

      const amounts = calculateFees(baseCents, listing.garmentValueCents);

      const lenderSnap = await tx.get(db().collection(COLLECTIONS.users).doc(listing.ownerUid));
      if (!lenderSnap.exists) throw notFound('We could not find that closet.');
      const lender = lenderSnap.data() as User;

      const summary = (u: User) => ({
        uid: u.uid,
        username: u.username,
        displayName: u.displayName,
        photoUrl: u.photoUrl,
        campusId: u.campusId,
        isVerified: u.isVerified,
      });

      // A request never auto-confirms at MVP — every one needs the lender's
      // approval. (`listing.requiresApproval` is forced true; see roadmap.)
      const booking: Omit<Booking, 'createdAt' | 'updatedAt'> = {
        id: bookingRef.id,
        kind: 'rental',
        status: 'requested',
        campusId: listing.campusId,
        listingId,
        listing: {
          listingId,
          name: listing.name,
          coverUrl: listing.coverUrl,
          ownerUid: listing.ownerUid,
          priceCents3Day: listing.pricing.threeDayCents,
          salePriceCents: listing.salePriceCents,
        },
        lenderUid: listing.ownerUid,
        lender: summary(lender),
        renterUid: renter.uid,
        renter: summary(renter),
        startDate,
        endDate,
        durationDays,
        amounts,
        payment: {
          paymentIntentId: null,
          holdPaymentIntentId: null,
          transferId: null,
          refundId: null,
          authorizedAt: null,
          capturedAt: null,
          holdReleasedAt: null,
        },
        renterMessage: message?.trim() || null,
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
          requestedAt: now() as never,
          respondedAt: null,
          confirmedAt: null,
          cancelledAt: null,
          completedAt: null,
        },
        cancelledByUid: null,
        cancellationReason: null,
        declineReason: null,
        // The lender has 48 hours, or until the day before the rental
        // starts, whichever comes first.
        expiresAt: Timestamp.fromDate(requestExpiry(startDate)),
        disputeWindowEndsAt: null,
        returnProblem: null,
        activeClaimId: null,
        reviews: { lenderReviewId: null, renterReviewId: null },
      };

      tx.set(bookingRef, { ...booking, createdAt: now(), updatedAt: now() });

      return booking.status;
    });

    logger.info('Booking requested', { bookingId: bookingRef.id, listingId, renterUid: renter.uid });

    // TODO-PHASE4: notify the lender.
    // TODO-PHASE5: authorize the renter's card here, before confirming.

    return { bookingId: bookingRef.id, status };
  },
);
