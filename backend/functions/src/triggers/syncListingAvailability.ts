import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import {
  BLOCKING_BOOKING_STATUSES,
  COLLECTIONS,
  datesInRange,
  type Booking,
} from '@loane/shared';
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
    const datesMoved =
      before?.startDate !== after?.startDate || before?.endDate !== after?.endDate;

    if (wasBlocking === isBlocking && !datesMoved) return;

    const snap = await db()
      .collection(COLLECTIONS.bookings)
      .where('listingId', '==', listingId)
      .where('status', 'in', BLOCKING_BOOKING_STATUSES as unknown as string[])
      .get();

    const booked = new Set<string>();
    for (const doc of snap.docs) {
      const booking = doc.data() as Booking;
      if (!booking.startDate || !booking.endDate) continue;
      for (const day of datesInRange({
        startDate: booking.startDate,
        endDate: booking.endDate,
      })) {
        booked.add(day);
      }
    }

    await db()
      .collection(COLLECTIONS.listings)
      .doc(listingId)
      .update({ bookedDates: [...booked].sort(), updatedAt: now() });

    logger.debug('Synced listing availability', { listingId, days: booked.size });
  },
);
