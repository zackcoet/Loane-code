import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
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
    if (!listingId) throw invalidArgument('Which piece do you want to remove?');

    const ref = db().collection(COLLECTIONS.listings).doc(listingId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('That piece is no longer listed.');

    const listing = snap.data() as Listing;
    if (listing.ownerUid !== user.uid) {
      throw permissionDenied("That's not your listing.");
    }
    if (listing.status === 'removed') {
      return { keptForHistory: false, bookingCount: 0 };
    }

    const bookings = await db()
      .collection(COLLECTIONS.bookings)
      .where('listingId', '==', listingId)
      .get();

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

    await ref.update({
      status: 'removed',
      removedAt: now(),
      updatedAt: now(),
    });

    logger.info('Listing removed', {
      listingId,
      ownerUid: user.uid,
      bookingCount: bookings.size,
    });

    return { keptForHistory: bookings.size > 0, bookingCount: bookings.size };
  },
);
