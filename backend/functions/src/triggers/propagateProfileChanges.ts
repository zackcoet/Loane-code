import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import type { BulkWriter } from 'firebase-admin/firestore';
import { COLLECTIONS, type User, type UserSummary } from '@loane/shared';
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

      Bookings are deliberately NOT rewritten: a completed rental is a
      record of what happened, and the name on it then is part of that
      record. A live one shows her current name because it reads the
      user document.
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
