import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, DISPUTE_OUTCOMES, type Booking } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { logAdminAction, requireAdminContext, requireReason } from './audit';
import { notify, pieceName } from '../bookings/transitions';

/**
 * Deciding a flagged return.
 *
 * The admin sees the drop-off photos and the return photos side by
 * side, picks who was at fault, and writes why. The rental then ends as
 * `completed` — because it did happen — carrying the decision with it.
 *
 * NO MONEY MOVES, because there is no money to move. When Phase 5
 * lands, "renter at fault" becomes the trigger for a claim against the
 * protection hold. Today it is a recorded judgement and a line in both
 * their histories, which is worth having anyway: the same name turning
 * up twice is the signal that matters.
 */

interface ResolveInput {
  bookingId: string;
  outcome: string;
  notes: string;
}

export const resolveDispute = onCall<ResolveInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { bookingId, outcome, notes: rawNotes } = request.data ?? {};
    if (!bookingId) throw invalidArgument('Which rental?');
    if (!(DISPUTE_OUTCOMES as readonly string[]).includes(outcome)) {
      throw invalidArgument('Pick an outcome.');
    }
    const notes = requireReason(rawNotes, 'Write what you decided and why.');

    const ref = db().collection(COLLECTIONS.bookings).doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('We could not find that rental.');

    const booking = snap.data() as Booking;
    if (booking.status !== 'disputed') throw failed('That rental is not disputed.');

    const batch = db().batch();

    batch.update(ref, {
      status: 'completed',
      disputeResolution: {
        outcome,
        notes,
        adminUid: admin.uid,
        decidedAt: now(),
      },
      'timeline.completedAt': now(),
      updatedAt: now(),
    });

    // The rental happened, so it counts in both their histories — the
    // same bookkeeping the sweep does for an undisputed return.
    batch.update(db().collection(COLLECTIONS.users).doc(booking.lenderUid), {
      'stats.rentalsAsLender': FieldValue.increment(1),
    });
    batch.update(db().collection(COLLECTIONS.users).doc(booking.renterUid), {
      'stats.rentalsAsRenter': FieldValue.increment(1),
    });
    batch.update(db().collection(COLLECTIONS.listings).doc(booking.listingId), {
      'stats.completedRentals': FieldValue.increment(1),
    });

    for (const uid of [booking.lenderUid, booking.renterUid]) {
      notify(batch, {
        uid,
        type: 'claim_resolved',
        title: 'Loane reviewed your rental',
        body: `${pieceName(booking)}: ${notes}`,
        bookingId,
      });
    }

    logAdminAction(batch, {
      admin,
      action: 'resolve_dispute',
      targetType: 'booking',
      targetId: bookingId,
      notes: `${outcome}: ${notes}`,
      before: { status: 'disputed', problem: booking.returnProblem?.type ?? null },
      after: { status: 'completed', outcome },
    });

    await batch.commit();
    logger.info('Dispute resolved', { bookingId, outcome, by: admin.uid });
    return { ok: true };
  },
);
