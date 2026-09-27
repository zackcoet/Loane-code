import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Booking } from '@loane/shared';
import { db, now, Timestamp, FieldValue } from '../lib/admin';
import { requireAdmin } from '../lib/guards';
import { notify, pieceName } from './transitions';

/**
 * The clock. Two things happen to bookings purely because time passed:
 *
 *   1. A request nobody answered goes stale and is declined.
 *   2. A return nobody complained about becomes completed.
 *
 * Both run hourly. Hourly rather than by the minute because neither is
 * urgent — a request expiring 40 minutes late costs nothing, and hourly
 * is 24 invocations a day instead of 1,440.
 *
 * NOTE FOR DEVELOPMENT: the emulator does not run scheduled functions on
 * a timer. `runBookingSweep` below does the same work and can be called
 * by an admin, which is how we test it locally.
 */

async function sweep(): Promise<{ expired: number; completed: number }> {
  const nowTs = Timestamp.now();
  let expired = 0;
  let completed = 0;

  // --- 1. Requests nobody answered ---------------------------------------
  const stale = await db()
    .collection(COLLECTIONS.bookings)
    .where('status', '==', 'requested')
    .where('expiresAt', '<=', nowTs)
    .limit(200)
    .get();

  for (const doc of stale.docs) {
    const booking = doc.data() as Booking;
    const batch = db().batch();
    batch.update(doc.ref, {
      status: 'declined',
      declineReason: 'No answer in time',
      expiresAt: null,
      'timeline.respondedAt': now(),
      updatedAt: now(),
    });
    // Both sides need to know: she is not getting the dress, and the
    // lender should know she missed it.
    notify(batch, {
      uid: booking.renterUid,
      type: 'rental_declined',
      title: 'Request expired',
      body: `${booking.lender.username} didn't answer in time about ${pieceName(booking)}.`,
      bookingId: doc.id,
    });
    notify(batch, {
      uid: booking.lenderUid,
      type: 'rental_declined',
      title: 'You missed a request',
      body: `A request for ${pieceName(booking)} expired before you answered.`,
      bookingId: doc.id,
    });
    await batch.commit();
    expired += 1;
  }

  // --- 2. Returns nobody flagged ------------------------------------------
  const settled = await db()
    .collection(COLLECTIONS.bookings)
    .where('status', '==', 'returned')
    .where('disputeWindowEndsAt', '<=', nowTs)
    .limit(200)
    .get();

  for (const doc of settled.docs) {
    const booking = doc.data() as Booking;
    const batch = db().batch();
    batch.update(doc.ref, {
      status: 'completed',
      disputeWindowEndsAt: null,
      'timeline.completedAt': now(),
      updatedAt: now(),
    });
    // The rental is over, so it counts towards both their histories.
    batch.update(db().collection(COLLECTIONS.users).doc(booking.lenderUid), {
      'stats.rentalsAsLender': FieldValue.increment(1),
    });
    batch.update(db().collection(COLLECTIONS.users).doc(booking.renterUid), {
      'stats.rentalsAsRenter': FieldValue.increment(1),
    });
    batch.update(db().collection(COLLECTIONS.listings).doc(booking.listingId), {
      'stats.completedRentals': FieldValue.increment(1),
    });
    await batch.commit();
    completed += 1;
  }

  if (expired || completed) logger.info('Booking sweep', { expired, completed });
  return { expired, completed };
}

export const sweepBookings = onSchedule(
  { schedule: 'every 60 minutes', region: 'us-central1' },
  async () => {
    await sweep();
  },
);

/**
 * The same sweep, callable by an admin.
 *
 * Exists because the emulator will not fire a scheduled function, and a
 * timer you cannot test is a timer you do not trust.
 */
export const runBookingSweep = onCall<
  Record<string, never>,
  Promise<{ expired: number; completed: number }>
>({ region: 'us-central1' }, async (request) => {
  requireAdmin(request);
  return sweep();
});
