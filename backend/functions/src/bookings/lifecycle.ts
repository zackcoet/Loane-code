import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  BLOCKING_BOOKING_STATUSES,
  COLLECTIONS,
  RETURN_DISPUTE_WINDOW_HOURS,
  RETURN_PROBLEMS,
  ids,
  rangesOverlap,
  type Booking,
  type ImageRef,
} from '@loane/shared';
import { db, now, Timestamp, FieldValue } from '../lib/admin';
import { alreadyTaken, failed, invalidArgument } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import {
  assertCanTransition,
  completeBooking,
  loadBookingFor,
  notify,
  pieceName,
} from './transitions';

/**
 * Everything that happens to a booking after it is requested.
 *
 * Each function is thin on purpose: it loads the booking, works out which
 * side is calling, asks `assertCanTransition` whether the move is
 * allowed, and writes. The rules themselves live in one table in
 * shared/src/constants.ts.
 *
 * Every step also writes an in-app alert to the other side, because a
 * student needs to know her dress was accepted and push notifications
 * are Phase 6.
 */

// ---------------------------------------------------------------------------
// Accept or decline
// ---------------------------------------------------------------------------

export const respondToBooking = onCall<
  { bookingId: string; accept: boolean; reason?: string },
  Promise<{ status: Booking['status'] }>
>({ region: 'us-central1' }, async (request) => {
  const user = await requireActiveUser(request);
  const { bookingId, accept, reason } = request.data ?? {};
  if (!bookingId) throw invalidArgument('Which rental?');

  const status = await db().runTransaction(async (tx) => {
    const { booking, actor, ref } = await loadBookingFor(bookingId, user.uid, tx);
    assertCanTransition(booking, accept ? 'confirmed' : 'declined', actor);

    if (accept) {
      // Confirming is the moment the dates become hers, so this is where
      // the conflict check has to happen again — another booking may have
      // been confirmed since she asked.
      const conflicts = await tx.get(
        db()
          .collection(COLLECTIONS.bookings)
          .where('listingId', '==', booking.listingId)
          .where('status', 'in', BLOCKING_BOOKING_STATUSES as string[]),
      );

      // Read before any write — a transaction requires it.
      const conversationRef = db()
        .collection(COLLECTIONS.conversations)
        .doc(ids.conversation(booking.lenderUid, booking.renterUid));
      const conversationSnap = await tx.get(conversationRef);
      const clash = conflicts.docs.some((doc) => {
        const other = doc.data() as Booking;
        if (doc.id === bookingId || !other.startDate || !other.endDate) return false;
        return rangesOverlap(
          { startDate: booking.startDate!, endDate: booking.endDate! },
          { startDate: other.startDate, endDate: other.endDate },
        );
      });
      if (clash) {
        throw alreadyTaken('You already confirmed someone else for those dates.');
      }

      tx.update(ref, {
        status: 'confirmed',
        expiresAt: null,
        'timeline.respondedAt': now(),
        'timeline.confirmedAt': now(),
        updatedAt: now(),
      });

      // Now that it is really happening, make sure they have a thread to
      // arrange the handoff — and paying, since Loane is not doing that
      // during beta. The id is the two uids sorted, so this is the SAME
      // thread as any chat they already had; it just gains a booking.
      //
      // Create it only if it is missing. A blind merge here would zero
      // an existing thread's unread badge and wipe its last-message
      // preview, which is exactly the wrong thing to do to two people
      // who have already been talking.
      if (!conversationSnap.exists) {
        tx.set(conversationRef, {
          id: conversationRef.id,
          campusId: booking.campusId,
          participantUids: [booking.lenderUid, booking.renterUid].sort(),
          participants: {
            [booking.lenderUid]: booking.lender,
            [booking.renterUid]: booking.renter,
          },
          listingId: booking.listingId,
          bookingId,
          lastMessage: null,
          unreadCounts: { [booking.lenderUid]: 0, [booking.renterUid]: 0 },
          createdAt: now(),
          updatedAt: now(),
        });
      } else if (!(conversationSnap.data() as { bookingId?: string }).bookingId) {
        tx.update(conversationRef, { bookingId, updatedAt: now() });
      }
      notify(tx, {
        uid: booking.renterUid,
        type: 'rental_accepted',
        title: 'Your rental is confirmed',
        body: `${booking.lender.username} said yes to ${pieceName(booking)}.`,
        bookingId,
        actor: {
          uid: booking.lenderUid,
          username: booking.lender.username,
          photoUrl: booking.lender.photoUrl,
        },
      });
      return 'confirmed' as const;
    }

    tx.update(ref, {
      status: 'declined',
      declineReason: reason?.trim() || null,
      expiresAt: null,
      'timeline.respondedAt': now(),
      updatedAt: now(),
    });
    notify(tx, {
      uid: booking.renterUid,
      type: 'rental_declined',
      title: 'Rental declined',
      body: `${booking.lender.username} can't lend ${pieceName(booking)} for those dates.`,
      bookingId,
    });
    return 'declined' as const;
  });

  logger.info('Booking answered', { bookingId, status });
  return { status };
});

// ---------------------------------------------------------------------------
// Handoff
// ---------------------------------------------------------------------------

/**
 * The lender records dropping the piece off, with a photo.
 *
 * The photo is required, and it is the only protection that works without
 * money moving: during beta there is no card on file and no hold, so a
 * before-and-after photo record is all a damage claim would have.
 */
export const recordDropoff = onCall<
  { bookingId: string; photos: ImageRef[]; notes?: string },
  Promise<{ ok: true }>
>({ region: 'us-central1' }, async (request) => {
  const user = await requireActiveUser(request);
  const { bookingId, photos = [], notes } = request.data ?? {};
  if (!bookingId) throw invalidArgument('Which rental?');
  if (photos.length === 0) {
    throw invalidArgument('Add a photo of the piece before you hand it over.');
  }

  await db().runTransaction(async (tx) => {
    const { booking, actor, ref } = await loadBookingFor(bookingId, user.uid, tx);
    if (actor !== 'lender') throw failed('Only the lender records a drop-off.');
    if (booking.status !== 'confirmed') {
      throw failed('This rental is not confirmed yet.');
    }

    tx.update(ref, {
      'handoff.dropoffPhotos': photos,
      'handoff.dropoffAt': now(),
      'handoff.notes': notes?.trim() || booking.handoff.notes,
      updatedAt: now(),
    });
    notify(tx, {
      uid: booking.renterUid,
      type: 'rental_upcoming',
      title: 'Your piece is on its way',
      body: `${booking.lender.username} dropped off ${pieceName(booking)}. Confirm when you have it.`,
      bookingId,
    });
  });

  return { ok: true };
});

/** The renter confirms the garment is in her hands. */
export const confirmReceipt = onCall<{ bookingId: string }, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const user = await requireActiveUser(request);
    const bookingId = request.data?.bookingId;
    if (!bookingId) throw invalidArgument('Which rental?');

    await db().runTransaction(async (tx) => {
      const { booking, actor, ref } = await loadBookingFor(bookingId, user.uid, tx);
      assertCanTransition(booking, 'with_renter', actor);

      if (booking.handoff.dropoffPhotos.length === 0) {
        throw failed('Ask the lender to record the drop-off photo first.');
      }

      tx.update(ref, {
        status: 'with_renter',
        'handoff.renterConfirmedReceiptAt': now(),
        updatedAt: now(),
      });
      notify(tx, {
        uid: booking.lenderUid,
        type: 'booking_confirmed',
        title: 'She has it',
        body: `${booking.renter.username} confirmed she received ${pieceName(booking)}.`,
        bookingId,
      });
    });

    return { ok: true };
  },
);

/**
 * Either side confirms the piece came back.
 *
 * This does NOT finish the rental. It starts a 48-hour window in which
 * the lender can flag a problem. Only after that, with no flag, does a
 * scheduled function mark it completed.
 */
export const confirmReturn = onCall<
  { bookingId: string; photos?: ImageRef[] },
  Promise<{ ok: true }>
>({ region: 'us-central1' }, async (request) => {
  const user = await requireActiveUser(request);
  const { bookingId, photos } = request.data ?? {};
  if (!bookingId) throw invalidArgument('Which rental?');

  await db().runTransaction(async (tx) => {
    const { booking, actor, ref } = await loadBookingFor(bookingId, user.uid, tx);

    // The second half of the handshake: she has said she returned it,
    // and now he is saying he has it back and it is fine. That ends
    // the rental there and then — waiting out a 48-hour window that
    // exists to catch a problem nobody has is just two days of a
    // rental neither of them can see the end of.
    if (booking.status === 'returned' && actor === 'lender') {
      assertCanTransition(booking, 'completed', actor);
      tx.update(ref, {
        'handoff.lenderConfirmedReturnAt': now(),
        ...(photos && photos.length > 0 ? { 'handoff.returnPhotos': photos } : {}),
      });
      // Same helper the sweep uses, so confirming promptly and letting
      // the window lapse leave identical state.
      completeBooking(tx, ref, booking);
      return;
    }

    assertCanTransition(booking, 'returned', actor);

    const windowEnds = new Date(Date.now() + RETURN_DISPUTE_WINDOW_HOURS * 3600_000);

    tx.update(ref, {
      status: 'returned',
      ...(actor === 'renter'
        ? { 'handoff.renterConfirmedReturnAt': now() }
        : { 'handoff.lenderConfirmedReturnAt': now() }),
      ...(photos && photos.length > 0 ? { 'handoff.returnPhotos': photos } : {}),
      disputeWindowEndsAt: Timestamp.fromDate(windowEnds),
      updatedAt: now(),
    });

    notify(tx, {
      uid: actor === 'lender' ? booking.renterUid : booking.lenderUid,
      type: 'return_confirmed',
      title: 'Return confirmed',
      body:
        actor === 'renter'
          ? `${booking.renter.username} returned ${pieceName(booking)}. You have 48 hours to flag a problem.`
          : `${booking.lender.username} confirmed ${pieceName(booking)} came back.`,
      bookingId,
    });
  });

  return { ok: true };
});

/**
 * The lender flags a problem with a return, inside the 48-hour window.
 *
 * This moves the booking to `disputed`, where it shows up for an admin.
 * In Phase 5 it also opens a damage claim against the protection hold;
 * for now the photos and the note are the whole record.
 */
export const flagReturnProblem = onCall<
  { bookingId: string; problem: string; note: string; photos: ImageRef[] },
  Promise<{ ok: true }>
>({ region: 'us-central1' }, async (request) => {
  const user = await requireActiveUser(request);
  const { bookingId, problem, note = '', photos = [] } = request.data ?? {};
  if (!bookingId) throw invalidArgument('Which rental?');
  if (!(RETURN_PROBLEMS as readonly string[]).includes(problem)) {
    throw invalidArgument('Pick what went wrong.');
  }
  if (photos.length === 0) {
    throw invalidArgument('Add at least one photo showing the problem.');
  }

  await db().runTransaction(async (tx) => {
    const { booking, actor, ref } = await loadBookingFor(bookingId, user.uid, tx);
    assertCanTransition(booking, 'disputed', actor);

    const deadline = booking.disputeWindowEndsAt as { toDate?: () => Date } | null;
    const ends = deadline?.toDate ? deadline.toDate() : null;
    if (ends && ends.getTime() < Date.now()) {
      throw failed('The 48-hour window to flag a problem has passed.');
    }

    tx.update(ref, {
      status: 'disputed',
      returnProblem: { type: problem, note: note.trim(), photos, flaggedAt: now() },
      updatedAt: now(),
    });
    notify(tx, {
      uid: booking.renterUid,
      type: 'claim_opened',
      title: 'A problem was reported',
      body: `${booking.lender.username} flagged a problem with ${pieceName(booking)}. Loane will review it.`,
      bookingId,
    });
  });

  logger.info('Return problem flagged', { bookingId, problem });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/** Either side can call it off before the garment changes hands. */
export const cancelBooking = onCall<
  { bookingId: string; reason: string },
  Promise<{ ok: true }>
>({ region: 'us-central1' }, async (request) => {
  const user = await requireActiveUser(request);
  const { bookingId, reason = '' } = request.data ?? {};
  if (!bookingId) throw invalidArgument('Which rental?');
  if (!reason.trim()) throw invalidArgument('Say why, so the other person knows.');

  await db().runTransaction(async (tx) => {
    const { booking, actor, ref } = await loadBookingFor(bookingId, user.uid, tx);
    assertCanTransition(booking, 'cancelled', actor);

    // Counted so a pattern is visible to an admin. One cancellation is
    // life; five in a month is a lender nobody can rely on.
    tx.update(db().collection(COLLECTIONS.users).doc(user.uid), {
      'stats.cancellations': FieldValue.increment(1),
      updatedAt: now(),
    });

    tx.update(ref, {
      status: 'cancelled',
      cancelledByUid: user.uid,
      cancellationReason: reason.trim(),
      expiresAt: null,
      'timeline.cancelledAt': now(),
      updatedAt: now(),
    });
    notify(tx, {
      uid: actor === 'lender' ? booking.renterUid : booking.lenderUid,
      type: 'rental_declined',
      title: 'Rental cancelled',
      body: `${actor === 'lender' ? booking.lender.username : booking.renter.username} cancelled ${pieceName(booking)}.`,
      bookingId,
    });
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// Lender's blocked dates
// ---------------------------------------------------------------------------

/**
 * Block or unblock days on a listing's calendar.
 *
 * This one could have been a direct write — blackoutDates is on the
 * listing and the rules already let an owner edit her own. It is here so
 * that blocking a day the renter has already been confirmed for is
 * refused rather than silently ignored.
 */
export const setBlockedDates = onCall<
  { listingId: string; dates: string[] },
  Promise<{ blocked: string[] }>
>({ region: 'us-central1' }, async (request) => {
  const user = await requireActiveUser(request);
  const { listingId, dates = [] } = request.data ?? {};
  if (!listingId) throw invalidArgument('Which piece?');

  const listingRef = db().collection(COLLECTIONS.listings).doc(listingId);
  const snap = await listingRef.get();
  if (!snap.exists) throw failed('That piece is no longer listed.');
  if ((snap.data() as { ownerUid: string }).ownerUid !== user.uid) {
    throw failed("That's not your listing.");
  }

  const booked = await db()
    .collection(COLLECTIONS.bookings)
    .where('listingId', '==', listingId)
    .where('status', 'in', BLOCKING_BOOKING_STATUSES as string[])
    .get();

  const taken = new Set<string>();
  for (const doc of booked.docs) {
    const b = doc.data() as Booking;
    if (!b.startDate || !b.endDate) continue;
    for (let d = b.startDate; d < b.endDate; ) {
      taken.add(d);
      const next = new Date(`${d}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      d = next.toISOString().slice(0, 10);
    }
  }

  const clash = dates.find((d) => taken.has(d));
  if (clash) {
    throw failed(`${clash} is already booked. Cancel that rental first.`);
  }

  const unique = [...new Set(dates)].sort();
  await listingRef.update({ blackoutDates: unique, updatedAt: now() });

  return { blocked: unique };
});
