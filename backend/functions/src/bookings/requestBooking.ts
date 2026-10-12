import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import type { Booking, DateRange, Listing, User } from '@loane/shared';
import {
  SAME_DAY_RESPONSE_HOURS,
  BLOCKING_BOOKING_STATUSES,
  COLLECTIONS,
  REQUEST_EXPIRY_HOURS,
  calculateFees,
  priceForDuration,
  newBookingPayment,
  daysBetween,
  formatRange,
  rangeHitsBlackout,
  rangesOverlap,
  toIsoDate,
  validateDateRange,
} from '@loane/shared';
import { db, now, Timestamp } from '../lib/admin';
import { alreadyTaken, failed, invalidArgument, notFound } from '../lib/errors';
import { requireHandoffReady, requireVerifiedStudent } from '../lib/guards';
import { assertNotBlocked } from '../moderation/block';
import { notify } from './transitions';

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
 * When an unanswered request goes stale: REQUEST_EXPIRY_HOURS from
 * now, or the day before the rental starts, whichever comes first. A
 * request for this Saturday should not sit unanswered until Saturday.
 */
function requestExpiry(startDate: string, sameDay: boolean): Date {
  /*
    TWO HOURS FOR SAME DAY, not twenty-four.

    A request for this afternoon that sits unanswered until tomorrow is
    worse than a decline: she has spent the evening assuming she has a
    dress. The short window is the whole promise of same-day.
  */
  const hours = sameDay ? SAME_DAY_RESPONSE_HOURS : REQUEST_EXPIRY_HOURS;
  const deadline = new Date(Date.now() + hours * 3600_000);
  const dayBeforeStart = new Date(`${startDate}T00:00:00Z`);
  dayBeforeStart.setUTCDate(dayBeforeStart.getUTCDate() - 1);
  return deadline < dayBeforeStart ? deadline : dayBeforeStart;
}

export const requestBooking = onCall<RequestBookingInput, Promise<RequestBookingResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<RequestBookingInput>): Promise<RequestBookingResult> => {
    const renter = await requireVerifiedStudent(request);
    // Before anything else: she is about to arrange to meet a stranger
    // from her campus and take a garment from her. The app asks for
    // these first; this is the same rule where it cannot be skipped.
    await requireHandoffReady(renter, 'you rent');
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
      const baseCents = priceForDuration(listing.pricing, durationDays);

      if (baseCents == null) {
        throw failed(`This piece isn't available for ${durationDays} days.`);
      }

      // The renter is charged the listed price plus the lender's own
      // cleaning charge. Loane's cut comes out of the lender's side, so
      // it never appears in what she pays.
      /*
        Same day is the renter asking for it TODAY, and only possible
        on a listing whose owner said yes to that.
      */
      const isSameDay = startDate === toIsoDate(new Date());
      if (isSameDay && !listing.sameDay?.enabled) {
        throw failed('This piece is not available same day. Pick a later date.');
      }

      const amounts = calculateFees({
        baseCents,
        garmentValueCents: listing.garmentValueCents,
        cleaningFeeCents: listing.cleaningFeeCents ?? 0,
        sameDay: isSameDay,
        // Her premium when she set one; the platform default otherwise.
        sameDayPremiumBps: listing.sameDay?.premiumBps ?? null,
      });

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
        payment: newBookingPayment(),
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
        // The lender has REQUEST_EXPIRY_HOURS, or until the day before
        // starts, whichever comes first.
        expiresAt: Timestamp.fromDate(requestExpiry(startDate, isSameDay)),
        disputeWindowEndsAt: null,
        returnProblem: null,
        disputeResolution: null,
      activeClaimId: null,
        reviews: { lenderReviewId: null, renterReviewId: null },
      };

      tx.set(bookingRef, { ...booking, createdAt: now(), updatedAt: now() });

      // Tell the lender, in the same transaction as the booking.
      //
      // This was a TODO, and it meant a request arrived in total
      // silence: the renter waited, the lender never knew, and the
      // request expired unanswered, having been seen by nobody.
      // A marketplace where asking to rent notifies no one is not a
      // marketplace.
      notify(tx, {
        uid: listing.ownerUid,
        type: 'rental_requested',
        title: `@${renter.username} wants to rent your ${listing.name}`,
        body:
          startDate && endDate
            ? `${formatRange({ startDate, endDate })} — accept or decline within ${REQUEST_EXPIRY_HOURS} hours.`
            : `Accept or decline within ${REQUEST_EXPIRY_HOURS} hours.`,
        bookingId: bookingRef.id,
        actor: { uid: renter.uid, username: renter.username, photoUrl: renter.photoUrl },
      });

      return booking.status;
    });

    logger.info('Booking requested', { bookingId: bookingRef.id, listingId, renterUid: renter.uid });

    // TODO-PHASE5: authorize the renter's card here, before confirming.

    return { bookingId: bookingRef.id, status };
  },
);
