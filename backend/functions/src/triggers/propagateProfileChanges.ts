import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import type { BulkWriter } from 'firebase-admin/firestore';
import { COLLECTIONS, OPEN_BOOKING_STATUSES, type User, type UserSummary } from '@loane/shared';
import { db, now } from '../lib/admin';

/**
 * Keeps the copies of a profile that live on her listings and posts in
 * step with the real thing.
 *
 * Listings and posts each carry a small snapshot of their owner — her
 * username, display name and photo — so a grid of thirty listings is one
 * read instead of thirty-one. The cost of that speed is exactly this: when
 * she changes her username, those copies go stale and her old handle
 * lingers all over the marketplace.
 *
 * This is the thing that pays that cost. It only runs when one of the
 * three copied fields actually changes, so an ordinary profile edit — a
 * new bio, a size — costs nothing.
 */

export const propagateProfileChanges = onDocumentUpdated(
  { document: `${COLLECTIONS.users}/{uid}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() as User | undefined;
    const after = event.data?.after.data() as User | undefined;
    if (!before || !after) return;
    if (!summaryChanged(before, after)) return;

    /*
      THE PROFILE AS IT IS NOW, not as this event remembers it.

      Change her name twice in quick succession and two runs of this job
      start at once, in no guaranteed order. Each used to copy the
      version in its own event, so if the first run finished last, her
      OLD name went back onto every look and chat and stayed there. Both
      runs reading the document fresh means both write the newest name.
    */
    const fresh = await db().collection(COLLECTIONS.users).doc(event.params.uid).get();
    if (!fresh.exists) return;
    const summary = summaryOf(fresh.data() as User);

    /*
      EVERY COPY, not just the two that render in a grid.

      A username change used to update listings and posts and stop
      there, so her old handle stayed on her comments and at the top of
      every chat she was in — the two places a name is read most often.
      changeUsername carried a TODO saying exactly this.

      Reviews she wrote and rentals still going get her new name too
      (see rewriteOpenBookings).
      A finished rental is a record of what happened, and the name on it
      then is part of that record, so it is left alone.
    */
    const writer = db().bulkWriter();
    // A look or piece she deletes while this runs is simply skipped. In a
    // plain batch, one vanished document failed all 400 writes beside it,
    // and the chats (rewritten last) were never reached at all.
    writer.onWriteError((error) => {
      if (error.code !== GRPC_NOT_FOUND) {
        logger.error('Could not refresh a profile copy', {
          uid: summary.uid,
          path: error.documentRef.path,
          code: error.code,
        });
      }
      return false;
    });

    const updated = {
      listings: await rewrite(writer, COLLECTIONS.listings, 'ownerUid', summary.uid, {
        owner: summary,
        updatedAt: now(),
      }),
      posts: await rewrite(writer, COLLECTIONS.posts, 'authorUid', summary.uid, {
        author: summary,
        updatedAt: now(),
      }),
      comments: await rewrite(writer, COLLECTIONS.comments, 'authorUid', summary.uid, {
        author: summary,
        updatedAt: now(),
      }),
      /*
        A chat stores both people's summaries under `participants`, keyed
        by uid. NO `updatedAt` here: the inbox is sorted by it, so a new
        profile photo used to float every chat she was in to the top of
        her inbox AND the other girl's, above the chats with real new
        messages in them.
      */
      conversations: await rewrite(
        writer,
        COLLECTIONS.conversations,
        'participantUids',
        summary.uid,
        { [`participants.${summary.uid}`]: summary },
        'array-contains',
      ),
      /*
        Reviews she wrote. Without this a review kept her old @name
        forever, and once someone else took that name the review read
        as theirs. No `updatedAt`: a new name is not an edit of what
        she wrote.
      */
      reviews: await rewrite(writer, COLLECTIONS.reviews, 'authorUid', summary.uid, {
        author: summary,
      }),
      bookings: await rewriteOpenBookings(writer, summary),
    };
    await writer.close();

    logger.info('Refreshed denormalized profile copies', { uid: summary.uid, ...updated });
  },
);

/** gRPC's "not found": the document was deleted after we read it. */
const GRPC_NOT_FOUND = 5;

/** Whether any of the fields copied onto her looks, pieces and chats moved. */
export function summaryChanged(before: User, after: User): boolean {
  return (
    before.username !== after.username ||
    before.displayName !== after.displayName ||
    before.photoUrl !== after.photoUrl ||
    before.isVerified !== after.isVerified ||
    before.campusId !== after.campusId
  );
}

export function summaryOf(user: User): UserSummary {
  return {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    photoUrl: user.photoUrl ?? null,
    campusId: user.campusId,
    isVerified: user.isVerified,
  };
}

/** Patches every document of hers in one collection. */
async function rewrite(
  writer: BulkWriter,
  collection: string,
  ownerField: string,
  uid: string,
  patch: Record<string, unknown>,
  op: '==' | 'array-contains' = '==',
): Promise<number> {
  // index-check: one equality/array-contains filter and no sort — no index needed.
  const snap = await db().collection(collection).where(ownerField, op, uid).get();
  for (const doc of snap.docs) {
    // A failed write is already logged (or deliberately ignored) by
    // onWriteError; this only stops it surfacing as an unhandled rejection.
    writer.update(doc.ref, patch).catch(() => undefined);
  }
  return snap.size;
}

/**
 * Her copy on every rental still going, as lender or renter.
 *
 * The rental screen, My Rentals and Rental requests all show the other
 * girl from the booking's own copy of her. This job used to skip
 * bookings on the belief that a live rental read the profile instead;
 * it never did. So after a rename, a girl arranging a handoff saw
 * "Renting from @oldname" on the rental while the chat beside it showed
 * the new one, and could not find her by the name she was shown.
 *
 * Only her own side is patched, and nothing else — no `updatedAt`,
 * status or dates — so it cannot move a rental in a list or wake the
 * calendar job (syncListingAvailability ignores changes that leave the
 * status and dates alone). Finished rentals keep the name they had.
 */
async function rewriteOpenBookings(writer: BulkWriter, summary: UserSummary): Promise<number> {
  const open = OPEN_BOOKING_STATUSES as unknown as string[];
  const bookings = db().collection(COLLECTIONS.bookings);
  // index-check: == on lenderUid / renterUid plus `in` on status, no sort —
  // served by the (lenderUid|renterUid, status, startDate) indexes.
  const [asLender, asRenter] = await Promise.all([
    bookings.where('lenderUid', '==', summary.uid).where('status', 'in', open).get(),
    bookings.where('renterUid', '==', summary.uid).where('status', 'in', open).get(),
  ]);
  for (const doc of asLender.docs) {
    writer.update(doc.ref, { lender: summary }).catch(() => undefined);
  }
  for (const doc of asRenter.docs) {
    writer.update(doc.ref, { renter: summary }).catch(() => undefined);
  }
  return asLender.size + asRenter.size;
}
