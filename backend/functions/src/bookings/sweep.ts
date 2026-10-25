import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, addDays, campusClock, type Booking, type Timestampish } from '@loane/shared';
import { db, now, Timestamp } from '../lib/admin';
import { requireAdmin } from '../lib/guards';
import { completeBooking, notify, pieceName } from './transitions';
import { isReminderHour, remindersDue } from './reminders';

type RemindableBooking = Booking & { remindersSent?: Record<string, boolean> };

/** How long before a request expires we nudge the lender. */
const EXPIRY_NUDGE_HOURS = 6;

/**
 * On the server these are always Firestore Timestamps; the shared type
 * is looser because the phone sees them in other shapes too.
 */
function millis(value: Timestampish | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  if (value instanceof Date) return value.getTime();
  return value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
}

function passed(deadline: Timestampish | null | undefined, nowTs: { toMillis(): number }): boolean {
  const at = millis(deadline);
  return at != null && at <= nowTs.toMillis();
}

/** Still waiting on the lender, and out of time. */
export function stillStale(
  booking: Pick<Booking, 'status'> & { expiresAt?: Timestampish | null },
  nowTs: { toMillis(): number },
): boolean {
  return booking.status === 'requested' && passed(booking.expiresAt, nowTs);
}

/** Back with the lender, and nobody complained within the window. */
export function stillSettled(
  booking: Pick<Booking, 'status'> & { disputeWindowEndsAt?: Timestampish | null },
  nowTs: { toMillis(): number },
): boolean {
  return booking.status === 'returned' && passed(booking.disputeWindowEndsAt, nowTs);
}

/**
 * The clock. Four things happen purely because time passed:
 *
 *   1. A request nobody answered goes stale and is declined.
 *   2. A return nobody complained about becomes completed.
 *   3. Reminders: starts tomorrow, due back today, overdue — only
 *      between 8 AM and 9 PM on campus.
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

async function sweep(byHand: boolean): Promise<SweepResult> {
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
    /*
      RE-READ, INSIDE A TRANSACTION.

      The list above was read a moment ago, outside any lock. If the
      lender said yes (or the renter cancelled) in between, a plain
      write here would turn her confirmed rental back into "Request
      expired". The transaction re-reads it and only declines what is
      still waiting and still past its deadline.
    */
    const didExpire = await db().runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const booking = snap.data() as Booking | undefined;
      if (!booking || !stillStale(booking, nowTs)) return false;

      tx.update(doc.ref, {
        status: 'declined',
        declineReason: 'No answer in time',
        expiresAt: null,
        'timeline.respondedAt': now(),
        updatedAt: now(),
      });
      // Both sides need to know: she is not getting the dress, and the
      // lender should know she missed it.
      notify(tx, {
        uid: booking.renterUid,
        type: 'rental_declined',
        title: 'Request expired',
        body: `${booking.lender.username} didn't answer in time about ${pieceName(booking)}.`,
        bookingId: doc.id,
      });
      notify(tx, {
        uid: booking.lenderUid,
        type: 'rental_declined',
        title: 'You missed a request',
        body: `A request for ${pieceName(booking)} expired before you answered.`,
        bookingId: doc.id,
      });
      return true;
    });
    if (didExpire) expired += 1;
  }

  // --- 2. Returns nobody flagged ------------------------------------------
  const settled = await db()
    .collection(COLLECTIONS.bookings)
    .where('status', '==', 'returned')
    .where('disputeWindowEndsAt', '<=', nowTs)
    .limit(200)
    .get();

  for (const doc of settled.docs) {
    // Re-read for the same reason as above: if she flagged a problem, or
    // the lender closed it by hand, in the moment since the list was
    // read, completing it again would bury the complaint or count the
    // rental twice in both their histories.
    const didComplete = await db().runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const booking = snap.data() as Booking | undefined;
      if (!booking || !stillSettled(booking, nowTs)) return false;
      // The same helper confirmReturn uses when the lender closes it by
      // hand, so the two endings cannot drift apart.
      completeBooking(tx, doc.ref, { ...booking, id: doc.id });
      return true;
    });
    if (didComplete) completed += 1;
  }

  // --- 3. Reminders -------------------------------------------------------
  // Each sent once. `remindersSent` on the booking is what stops the
  // hourly run turning one reminder into twenty-four. What is due is
  // decided in `remindersDue` (reminders.ts), on the CAMPUS date.
  const clock = campusClock();
  if (byHand || isReminderHour(clock.hour)) {
    const today = clock.today;
    const tomorrow = addDays(today, 1);

    /*
      ONLY THE BOOKINGS A REMINDER COULD BE FOR.

      This used to read the first 300 confirmed or live rentals in no
      particular order. Past 300, some rentals would never be reminded
      at all — and which ones would change from hour to hour. These two
      reads only take rentals starting today or tomorrow, and rentals
      due back by tomorrow (or late by up to a week), which is a small set however big Loane gets.
    */
    const [starting, dueBack] = await Promise.all([
      db()
        .collection(COLLECTIONS.bookings)
        .where('status', '==', 'confirmed')
        .where('startDate', '>=', today)
        .where('startDate', '<=', tomorrow)
        .limit(500)
        .get(),
      db()
        .collection(COLLECTIONS.bookings)
        .where('status', '==', 'with_renter')
        // A week back is room for "overdue" to go out even after a few
        // missed runs, without long-lost rentals crowding the read.
        .where('endDate', '>=', addDays(today, -7))
        .where('endDate', '<=', tomorrow)
        .limit(500)
        .get(),
    ]);

    for (const doc of [...starting.docs, ...dueBack.docs]) {
      /*
        RE-READ, INSIDE A TRANSACTION, like the two steps above. If she
        handed it back since the list was read, "Due back today" would
        land after the fact; and two sweeps at once would each send it.
      */
      const sentCount = await db().runTransaction(async (tx) => {
        const snap = await tx.get(doc.ref);
        if (!snap.exists) return 0;
        const booking = { ...(snap.data() as RemindableBooking), id: doc.id };
        const due = remindersDue(booking, today);
        if (due.length === 0) return 0;

        for (const item of due) {
          notify(tx, {
            uid: item.uid,
            type: item.type,
            title: item.title,
            body: item.body,
            bookingId: doc.id,
          });
        }
        const keys = [...new Set(due.map((d) => d.key))];
        tx.update(doc.ref, {
          ...Object.fromEntries(keys.map((k) => [`remindersSent.${k}`, true])),
          updatedAt: now(),
        });
        return due.length;
      });
      reminders += sentCount;
    }
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

  /*
    A REQUEST RUNNING OUT OF TIME.

    She has 24 hours — 2 if it is same-day — and an auto-decline she
    never saw coming costs the renter her evening and the lender the
    rental. The nudge goes out when a quarter of the window is left,
    so it is a prompt rather than an alarm.
  */
  const soon = Timestamp.fromMillis(Date.now() + EXPIRY_NUDGE_HOURS * 3600_000);
  const expiring = await db()
    .collection(COLLECTIONS.bookings)
    .where('status', '==', 'requested')
    .where('expiresAt', '<', soon)
    .limit(200)
    .get();

  for (const doc of expiring.docs) {
    // Re-read: if she answered in the moment since the list was read,
    // "about to expire" would nag her about something already done.
    const nudged = await db().runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const booking = snap.data() as RemindableBooking | undefined;
      if (!booking || booking.status !== 'requested' || booking.remindersSent?.expiringSoon) {
        return false;
      }
      notify(tx, {
        uid: booking.lenderUid,
        type: 'rental_requested',
        title: 'A request is about to expire',
        body: `${booking.renter.displayName} is waiting on ${pieceName(booking)}. Answer before it declines itself.`,
        // The document's own id. `booking.id` is not always saved inside
        // it, and an alert with no booking opens nothing when tapped.
        bookingId: doc.id,
      });
      tx.update(doc.ref, { 'remindersSent.expiringSoon': true, updatedAt: now() });
      return true;
    });
    if (nudged) reminders += 1;
  }

  if (expired || completed || reminders || alertsPurged) {
    logger.info('Booking sweep', { expired, completed, reminders, alertsPurged });
  }
  return { expired, completed, reminders, alertsPurged };
}

export const sweepBookings = onSchedule(
  { schedule: 'every 60 minutes', region: 'us-central1' },
  async () => {
    await sweep(false);
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
    // By hand means now: an admin running it wants the reminders out,
    // whatever the hour on campus.
    return sweep(true);
  },
);
