import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Booking } from '@loane/shared';
import { db, now, Timestamp } from '../lib/admin';
import { requireAdmin } from '../lib/guards';
import { completeBooking, notify, pieceName } from './transitions';

/**
 * The clock. Four things happen purely because time passed:
 *
 *   1. A request nobody answered goes stale and is declined.
 *   2. A return nobody complained about becomes completed.
 *   3. Reminders: starts tomorrow, due back today, overdue.
 *   4. Read alerts older than 30 days are deleted.
 *
 * Both run hourly. Hourly rather than by the minute because neither is
 * urgent — a request expiring 40 minutes late costs nothing, and hourly
 * is 24 invocations a day instead of 1,440.
 *
 * NOTE FOR DEVELOPMENT: the emulator does not run scheduled functions on
 * a timer. `runBookingSweep` below does the same work and can be called
 * by an admin, which is how we test it locally.
 */

interface SweepResult {
  expired: number;
  completed: number;
  reminders: number;
  alertsPurged: number;
}

async function sweep(): Promise<SweepResult> {
  const nowTs = Timestamp.now();
  let expired = 0;
  let completed = 0;
  let reminders = 0;
  let alertsPurged = 0;

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
    // The same helper confirmReturn uses when the lender closes it by
    // hand, so the two endings cannot drift apart.
    completeBooking(batch, doc.ref, booking);
    await batch.commit();
    completed += 1;
  }

  // --- 3. Reminders -------------------------------------------------------
  // Three nudges, each sent once. `remindersSent` on the booking is what
  // stops the hourly run turning one reminder into twenty-four.
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const live = await db()
    .collection(COLLECTIONS.bookings)
    .where('status', 'in', ['confirmed', 'with_renter'])
    .limit(300)
    .get();

  for (const doc of live.docs) {
    const booking = doc.data() as Booking & { remindersSent?: Record<string, boolean> };
    const sent = booking.remindersSent ?? {};

    const due: { key: string; uid: string; title: string; body: string }[] = [];

    if (booking.status === 'confirmed' && booking.startDate === tomorrow && !sent.startsTomorrow) {
      due.push({
        key: 'startsTomorrow',
        uid: booking.renterUid,
        title: 'Your rental starts tomorrow',
        body: `${pieceName(booking)} from ${booking.lender.username}. Sort out the handoff.`,
      });
      due.push({
        key: 'startsTomorrow',
        uid: booking.lenderUid,
        title: 'You are lending tomorrow',
        body: `${pieceName(booking)} goes to ${booking.renter.username}.`,
      });
    }

    if (booking.status === 'with_renter' && booking.endDate === today && !sent.dueToday) {
      due.push({
        key: 'dueToday',
        uid: booking.renterUid,
        title: 'Due back today',
        body: `Time to return ${pieceName(booking)} to ${booking.lender.username}.`,
      });
    }

    if (
      booking.status === 'with_renter' &&
      booking.endDate &&
      booking.endDate < today &&
      !sent.overdue
    ) {
      due.push({
        key: 'overdue',
        uid: booking.renterUid,
        title: 'This is overdue',
        body: `${pieceName(booking)} was due back on ${booking.endDate}.`,
      });
      due.push({
        key: 'overdue',
        uid: booking.lenderUid,
        title: 'A rental is overdue',
        body: `${booking.renter.username} still has ${pieceName(booking)}.`,
      });
    }

    if (due.length === 0) continue;

    const batch = db().batch();
    for (const item of due) {
      notify(batch, {
        uid: item.uid,
        type: item.key === 'dueToday' || item.key === 'overdue' ? 'return_reminder' : 'rental_upcoming',
        title: item.title,
        body: item.body,
        bookingId: doc.id,
      });
    }
    const keys = [...new Set(due.map((d) => d.key))];
    batch.update(doc.ref, {
      remindersSent: { ...sent, ...Object.fromEntries(keys.map((k) => [k, true])) },
      updatedAt: now(),
    });
    await batch.commit();
    reminders += due.length;
  }

  // --- 4. Old read alerts --------------------------------------------------
  // A notification she read a month ago is clutter she pays to store.
  // Unread ones are left alone however old — if she never saw it, it is
  // not ours to delete.
  const cutoff = Timestamp.fromMillis(Date.now() - 30 * 86_400_000);
  const oldAlerts = await db()
    .collectionGroup('notifications')
    .where('readAt', '<=', cutoff)
    .limit(400)
    .get();

  if (!oldAlerts.empty) {
    const batch = db().batch();
    oldAlerts.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    alertsPurged = oldAlerts.size;
  }

  if (expired || completed || reminders || alertsPurged) {
    logger.info('Booking sweep', { expired, completed, reminders, alertsPurged });
  }
  return { expired, completed, reminders, alertsPurged };
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
export const runBookingSweep = onCall<Record<string, never>, Promise<SweepResult>>(
  { region: 'us-central1' },
  async (request) => {
    requireAdmin(request);
    return sweep();
  },
);
