import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Listing } from '@loane/shared';
import { db, now } from '../lib/admin';
import { failed, invalidArgument, notFound, permissionDenied } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';

/**
 * `removeListing`
 *
 * Takes a piece out of the marketplace.
 *
 * NOTHING IS EVER HARD-DELETED. A listing that has been rented is part of
 * someone else's rental history, their reviews and — later — their
 * receipts. Deleting the row would tear a hole in all of that.
 *
 * This has to be a Cloud Function rather than a write from the app,
 * because deciding whether a listing has history means reading the
 * bookings collection, and the security rules only let a student see
 * bookings she is part of. The app genuinely cannot answer the question.
 *
 * Either way the listing ends up hidden. The difference is what we tell
 * her, and whether an active rental blocks it entirely.
 */

interface RemoveListingInput {
  listingId: string;
}

interface RemoveListingResult {
  /** True when the piece has rental history and is kept for the record. */
  keptForHistory: boolean;
  bookingCount: number;
}

/** A booking in one of these states means the piece is out or spoken for. */
const LIVE_STATUSES = ['requested', 'confirmed', 'with_renter', 'disputed'];

export const removeListing = onCall<RemoveListingInput, Promise<RemoveListingResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<RemoveListingInput>): Promise<RemoveListingResult> => {
    const user = await requireActiveUser(request);
    const listingId = request.data?.listingId;
    if (typeof listingId !== 'string' || listingId === '') {
      throw invalidArgument('Which piece do you want to remove?');
    }

    const ref = db().collection(COLLECTIONS.listings).doc(listingId);
    const bookingsQuery = db().collection(COLLECTIONS.bookings).where('listingId', '==', listingId);

    /*
      ONE TRANSACTION, because a request can land while she is removing.

      Read-then-write would let this happen: we see no rentals, a renter's
      request goes through a moment later (it only checked the piece was
      still up), and then we take the piece down — leaving a girl waiting
      on a piece nobody can see. Asking to rent reads the listing in its
      own transaction, so doing the same here means one of the two always
      goes first and the other sees the result.
    */
    const result = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw notFound('That piece is no longer listed.');

      const listing = snap.data() as Listing;
      if (listing.ownerUid !== user.uid) {
        throw permissionDenied("That's not your listing.");
      }
      if (listing.status === 'removed') {
        return { keptForHistory: false, bookingCount: 0, changed: false };
      }

      const bookings = await tx.get(bookingsQuery);

      // An in-flight rental blocks removal outright — someone is either
      // waiting on an answer or physically holding the garment.
      const live = bookings.docs.filter((d) =>
        LIVE_STATUSES.includes((d.data() as { status: string }).status),
      );
      if (live.length > 0) {
        throw failed(
          'This piece has a rental in progress. Finish or cancel it before removing the listing.',
        );
      }

      tx.update(ref, {
        status: 'removed',
        removedAt: now(),
        updatedAt: now(),
      });

      return { keptForHistory: bookings.size > 0, bookingCount: bookings.size, changed: true };
    });

    if (!result.changed) return { keptForHistory: false, bookingCount: 0 };

    logger.info('Listing removed', {
      listingId,
      ownerUid: user.uid,
      bookingCount: result.bookingCount,
    });

    return { keptForHistory: result.keptForHistory, bookingCount: result.bookingCount };
  },
);
