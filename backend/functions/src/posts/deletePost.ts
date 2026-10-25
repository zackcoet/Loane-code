import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Post } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { invalidArgument, notFound, permissionDenied } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import { isDocId, isPlainObject } from '../lib/input';

/**
 * `deletePost`
 *
 * A soft delete: the post disappears everywhere, and the row survives.
 *
 * The row matters because its likes and its `tagTapCount` are part of how
 * we answer whether the social side drives rentals. Deleting it would
 * quietly delete evidence.
 *
 * It is a function rather than a write because taking a post down has to
 * give back the `tagCount` it added to each tagged listing, which is a
 * write to somebody else's documents.
 */

export const deletePost = onCall<unknown, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<unknown>): Promise<{ ok: true }> => {
    const user = await requireActiveUser(request);
    const postId = isPlainObject(request.data) ? request.data.postId : undefined;
    if (!isDocId(postId)) throw invalidArgument('Which post do you want to delete?');

    const ref = db().collection(COLLECTIONS.posts).doc(postId);

    // One step, so a double-tap (or two phones) can't both get past the
    // "already removed?" check and give the counts back twice.
    try {
      await removeOnce(ref, user.uid);
    } catch (error) {
      // Two deletes at the same moment fight over the same documents and
      // the database can give up on the loser. If the look is down by
      // now, the other tap did it — that is a success, not an error.
      const after = await ref.get().catch(() => null);
      const post = after?.data() as Post | undefined;
      if (post?.authorUid !== user.uid || post.status !== 'removed') throw error;
    }

    logger.info('Post removed', { postId, uid: user.uid });
    return { ok: true };
  },
);

/** Takes the look down and gives its counts back, once, in one step. */
async function removeOnce(ref: FirebaseFirestore.DocumentReference, uid: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound('That post is gone.');

    const post = snap.data() as Post;
    if (post.authorUid !== uid) throw permissionDenied("That's not your post.");
    if (post.status === 'removed') return;

    // A tagged piece can be gone entirely (its owner's account was
    // deleted); updating a missing document would fail the whole
    // delete, so only hand the count back to pieces that still exist.
    const listingRefs = [...new Set(post.taggedListingIds ?? [])]
      .filter(isDocId)
      .map((id) => db().collection(COLLECTIONS.listings).doc(id));
    const listingSnaps = listingRefs.length > 0 ? await tx.getAll(...listingRefs) : [];

    tx.update(ref, { status: 'removed', removedAt: now(), updatedAt: now() });
    tx.update(db().collection(COLLECTIONS.users).doc(uid), {
      'stats.postCount': FieldValue.increment(-1),
      updatedAt: now(),
    });
    for (const listing of listingSnaps) {
      if (listing.exists) {
        tx.update(listing.ref, { 'stats.tagCount': FieldValue.increment(-1) });
      }
    }
  });
}
