/**
 * `requestPurchase` — Own It.
 *
 * A PURCHASE IS A BOOKING WITH NO DATES. That is not a shortcut, it is
 * the shape the data model was drawn in: `Booking.kind` has always had
 * 'purchase' in it and the date fields have always said "null for a
 * purchase". Reusing it means Own It gets accept, decline, the 24-hour
 * expiry sweep, the handoff photos, both confirmations, the chat
 * thread and every notification — for free, and identically, rather
 * than as a second lifecycle that drifts from the first.
 *
 * BLOCKED BY A CONFIRMED RENTAL. Somebody else has already been
 * promised this piece for a weekend; selling it out from under her is
 * the one thing a rental marketplace cannot do. She is told the date it
 * comes back rather than just refused.
 *
 * STRIPE GOES IN ONE PLACE. `newBookingPayment()` already builds the
 * payment block every booking carries, and the money is computed by
 * the same `calculateFees` the rentals use. When payments land, this
 * function authorizes a card and nothing else about the flow changes —
 * which is the point of building it this way now.
 */

import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  BLOCKING_BOOKING_STATUSES,
  COLLECTIONS,
  REQUEST_EXPIRY_HOURS,
  calculateFees,
  formatShortDate,
  newBookingPayment,
  toIsoDate,
  type Booking,
  type Listing,
} from '@loane/shared';
import { db, now, Timestamp } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireHandoffReady, requireVerifiedStudent } from '../lib/guards';
import { assertNotBlocked } from '../moderation/block';
import { notify } from './transitions';

interface Input {
  listingId: string;
  message?: string;
}

export const requestPurchase = onCall<Input, Promise<{ bookingId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<Input>) => {
    const buyer = await requireVerifiedStudent(request);
    // A purchase is still two students meeting in person.
    await requireHandoffReady(buyer, 'you buy');

    const { listingId, message } = request.data ?? {};
    if (!listingId) throw invalidArgument('Pick a piece to buy.');

    const listingSnapForBlock = await db().collection(COLLECTIONS.listings).doc(listingId).get();
    if (listingSnapForBlock.exists) {
      await assertNotBlocked(buyer.uid, (listingSnapForBlock.data() as Listing).ownerUid);
    }

    const listingRef = db().collection(COLLECTIONS.listings).doc(listingId);
    const bookingRef = db().collection(COLLECTIONS.bookings).doc();

    await db().runTransaction(async (tx) => {
      const listingSnap = await tx.get(listingRef);
      if (!listingSnap.exists) throw notFound('That piece is no longer listed.');
      const listing = listingSnap.data() as Listing;

      if (listing.status === 'sold') throw failed('That piece has already been sold.');
      if (listing.status !== 'active') throw failed('That piece is not available right now.');
      if (listing.intent === 'rent') throw failed('That piece is for rent, not for sale.');
      if (listing.salePriceCents == null) throw failed('That piece is not for sale.');
      if (listing.ownerUid === buyer.uid) throw failed("That's your own listing.");
      if (listing.campusId !== buyer.campusId) {
        throw failed('You can only buy from closets on your own campus.');
      }

      /*
        A CONFIRMED RENTAL BEATS A PURCHASE.

        Read inside the transaction, so a rental confirmed between the
        check and the commit forces a retry rather than selling a piece
        somebody is already expecting.
      */
      const today = toIsoDate(new Date());
      const blocking = await tx.get(
        db()
          .collection(COLLECTIONS.bookings)
          .where('listingId', '==', listingId)
          .where('status', 'in', BLOCKING_BOOKING_STATUSES as string[]),
      );

      const future = blocking.docs
        .map((d) => d.data() as Booking)
        .filter((b) => b.kind === 'rental' && b.endDate && b.endDate > today)
        .sort((a, b) => (a.endDate! < b.endDate! ? 1 : -1))[0];

      if (future?.endDate) {
        // The date, not just a refusal — it is the one thing that tells
        // her whether waiting is worth it.
        throw failed(`On Loane until ${formatShortDate(future.endDate)}.`);
      }

      /*
        One open request per buyer.

        A SEPARATE QUERY, because `requested` is deliberately NOT a
        blocking status — an unanswered request does not hold a piece,
        so the set above does not contain it. Checking there let two
        taps make two purchase requests, which is exactly what happened
        the first time this was tested.
      */
      const open = await tx.get(
        db()
          .collection(COLLECTIONS.bookings)
          .where('listingId', '==', listingId)
          .where('renterUid', '==', buyer.uid)
          .where('status', '==', 'requested'),
      );
      if (open.docs.some((d) => (d.data() as Booking).kind === 'purchase')) {
        throw failed('You have already asked to buy this.');
      }

      const fees = calculateFees({
        baseCents: listing.salePriceCents!,
        // Not a rental: nothing is coming back, so there is no
        // liability cap to compute against the garment's value.
        garmentValueCents: 0,
        cleaningFeeCents: listing.cleaningFeeCents ?? 0,
        sameDay: false,
      });

      const booking: Omit<Booking, 'createdAt' | 'updatedAt'> = {
        id: bookingRef.id,
        campusId: listing.campusId,
        kind: 'purchase',
        status: 'requested',
        listingId,
        listing: {
          id: listing.id,
          name: listing.name,
          coverUrl: listing.coverUrl,
          category: listing.category,
          size: listing.size,
        },
        lenderUid: listing.ownerUid,
        lender: listing.owner,
        renterUid: buyer.uid,
        renter: {
          uid: buyer.uid,
          username: buyer.username,
          displayName: buyer.displayName,
          photoUrl: buyer.photoUrl,
          campusId: buyer.campusId,
          isVerified: buyer.isVerified,
        },
        // No dates. A purchase is not a span of time.
        startDate: null,
        endDate: null,
        durationDays: null,
        amounts: {
          baseCents: fees.baseCents,
          cleaningFeeCents: fees.cleaningFeeCents,
          sameDayPremiumCents: 0,
          platformFeeCents: fees.platformFeeCents,
          renterTotalCents: fees.renterTotalCents,
          lenderPayoutCents: fees.lenderPayoutCents,
          liabilityCapCents: 0,
          feePaidBy: fees.feePaidBy,
        },
        payment: newBookingPayment(),
        renterMessage: message?.trim() || null,
        declineReason: null,
        cancelledBy: null,
        cancelReason: null,
        returnProblem: null,
        handoff: { dropoffPhotos: [], returnPhotos: [], dropoffAt: null, returnedAt: null },
        reviews: { lenderReviewId: null, renterReviewId: null },
        // The same 24 hours a rental request gets.
        expiresAt: Timestamp.fromMillis(Date.now() + REQUEST_EXPIRY_HOURS * 3600_000),
      } as unknown as Omit<Booking, 'createdAt' | 'updatedAt'>;

      tx.set(bookingRef, { ...booking, createdAt: now(), updatedAt: now() });

      notify(tx, {
        uid: listing.ownerUid,
        type: 'rental_requested',
        title: `@${buyer.username} wants to buy your ${listing.name}`,
        body: `Accept or decline within ${REQUEST_EXPIRY_HOURS} hours.`,
        bookingId: bookingRef.id,
        actor: { uid: buyer.uid, username: buyer.username, photoUrl: buyer.photoUrl },
      });
    });

    logger.info('Purchase requested', { bookingId: bookingRef.id, listingId });
    return { bookingId: bookingRef.id };
  },
);
