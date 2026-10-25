import { onCall } from '../lib/callable';
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
    const {
      bookingId,
      outcome,
      notes: rawNotes,
    } = (request.data ?? {}) as Partial<Record<keyof ResolveInput, unknown>>;
    if (
      typeof bookingId !== 'string' ||
      !bookingId.trim() ||
      bookingId.length > 128 ||
      bookingId.includes('/')
    ) {
      throw invalidArgument('Which rental?');
    }
    if (typeof outcome !== 'string' || !(DISPUTE_OUTCOMES as readonly string[]).includes(outcome)) {
      throw invalidArgument('Pick an outcome.');
    }
    const notes = requireReason(rawNotes, 'Write what you decided and why.');

    const ref = db().collection(COLLECTIONS.bookings).doc(bookingId);

    // One step. As two separate steps, two admins deciding the same
    // rental at once (or one double-click) both got through, and each
    // added the rental to both girls' histories — counted twice.
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw notFound('We could not find that rental.');

      const booking = snap.data() as Booking;
      if (booking.status !== 'disputed') {
        throw failed(
          booking.status === 'completed'
            ? 'That rental was already decided.'
            : 'That rental is not disputed.',
        );
      }

      tx.update(ref, {
        status: 'completed',
        disputeResolution: {
          outcome,
          notes,
          adminUid: admin.uid,
          decidedAt: now(),
        },
        // Matches an undisputed finish (completeBooking): the window to
        // flag a problem is closed for good.
        disputeWindowEndsAt: null,
        'timeline.completedAt': now(),
        updatedAt: now(),
      });

      // The rental happened, so it counts in both their histories — the
      // same bookkeeping the sweep does for an undisputed return.
      tx.update(db().collection(COLLECTIONS.users).doc(booking.lenderUid), {
        'stats.rentalsAsLender': FieldValue.increment(1),
      });
      tx.update(db().collection(COLLECTIONS.users).doc(booking.renterUid), {
        'stats.rentalsAsRenter': FieldValue.increment(1),
      });
      tx.update(db().collection(COLLECTIONS.listings).doc(booking.listingId), {
        'stats.completedRentals': FieldValue.increment(1),
      });

      for (const uid of [booking.lenderUid, booking.renterUid]) {
        notify(tx, {
          uid,
          type: 'claim_resolved',
          title: 'Loane reviewed your rental',
          body: `${pieceName(booking)}: ${notes}`,
          bookingId,
        });
      }

      logAdminAction(tx, {
        admin,
        action: 'resolve_dispute',
        targetType: 'booking',
        targetId: bookingId,
        notes: `${outcome}: ${notes}`,
        before: { status: 'disputed', problem: booking.returnProblem?.type ?? null },
        after: { status: 'completed', outcome },
      });
    });

    logger.info('Dispute resolved', { bookingId, outcome, by: admin.uid });
    return { ok: true };
  },
);
