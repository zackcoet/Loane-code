import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { BLOCKING_BOOKING_STATUSES, COLLECTIONS, datesInRange, type Booking } from '@loane/shared';
import { db, now } from '../lib/admin';

/**
 * Publishes a listing's booked dates so renters can see them.
 *
 * A renter cannot read other people's bookings — the rules stop her, and
 * they should: who rented what is nobody else's business. But her
 * calendar still has to grey out a weekend that is already taken.
 *
 * So this keeps a stripped-down copy on the listing itself: dates only,
 * no names, no prices, nothing about who has it.
 *
 * IT IS NOT THE SOURCE OF TRUTH. `requestBooking` still checks the
 * bookings collection inside a transaction, which is what actually makes
 * double-booking impossible. This copy only decides what she sees greyed
 * out; if it were ever briefly stale, the worst case is a request that
 * gets refused with a clear message.
 */

export const syncListingAvailability = onDocumentWritten(
  { document: `${COLLECTIONS.bookings}/{bookingId}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() as Booking | undefined;
    const after = event.data?.after.data() as Booking | undefined;

    const listingId = after?.listingId ?? before?.listingId;
    if (!listingId) return;

    // Only a change that could move dates in or out of the blocked set
    // matters. Editing a handoff note should not trigger a recompute.
    const wasBlocking = before ? BLOCKING_BOOKING_STATUSES.includes(before.status) : false;
    const isBlocking = after ? BLOCKING_BOOKING_STATUSES.includes(after.status) : false;
    const datesMoved = before?.startDate !== after?.startDate || before?.endDate !== after?.endDate;

    if (wasBlocking === isBlocking && !datesMoved) return;

    /*
      IN A TRANSACTION. Two bookings on one piece changing at once — a
      yes and a cancel a second apart — are two runs of this job. Each
      used to read the bookings, then write its answer; the one that
      read first could write last and put back a weekend that had just
      been freed, or drop one that had just been taken. Inside a
      transaction the read and the write are one step, so the last
      write is always the true picture.
    */
    const listingRef = db().collection(COLLECTIONS.listings).doc(listingId);
    const days = await db().runTransaction(async (tx) => {
      const [listing, snap] = await Promise.all([
        tx.get(listingRef),
        tx.get(
          db()
            .collection(COLLECTIONS.bookings)
            .where('listingId', '==', listingId)
            .where('status', 'in', BLOCKING_BOOKING_STATUSES as unknown as string[]),
        ),
      ]);
      // A removed piece has nobody left to show a calendar to.
      if (!listing.exists) return null;

      const bookedDates = bookedDatesOf(snap.docs.map((d) => d.data() as Booking));
      tx.update(listingRef, { bookedDates, updatedAt: now() });
      return bookedDates.length;
    });

    logger.debug('Synced listing availability', { listingId, days });
  },
);

/** Every day any of these bookings holds the piece, sorted, no repeats. */
export function bookedDatesOf(bookings: Pick<Booking, 'startDate' | 'endDate'>[]): string[] {
  const booked = new Set<string>();
  for (const booking of bookings) {
    // A sale has no dates: it never greys out a day.
    if (!booking.startDate || !booking.endDate) continue;
    for (const day of datesInRange({ startDate: booking.startDate, endDate: booking.endDate })) {
      booked.add(day);
    }
  }
  return [...booked].sort();
}
