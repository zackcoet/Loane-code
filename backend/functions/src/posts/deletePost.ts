import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Post } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { invalidArgument, notFound, permissionDenied } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';

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

export const deletePost = onCall<{ postId: string }, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<{ postId: string }>): Promise<{ ok: true }> => {
    const user = await requireActiveUser(request);
    const postId = request.data?.postId;
    if (!postId) throw invalidArgument('Which post do you want to delete?');

    const ref = db().collection(COLLECTIONS.posts).doc(postId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('That post is gone.');

    const post = snap.data() as Post;
    if (post.authorUid !== user.uid) throw permissionDenied("That's not your post.");
    if (post.status === 'removed') return { ok: true };

    const batch = db().batch();
    batch.update(ref, { status: 'removed', removedAt: now(), updatedAt: now() });
    batch.update(db().collection(COLLECTIONS.users).doc(user.uid), {
      'stats.postCount': FieldValue.increment(-1),
      updatedAt: now(),
    });
    // Hand back the tag count this post was holding.
    for (const listingId of post.taggedListingIds ?? []) {
      batch.update(db().collection(COLLECTIONS.listings).doc(listingId), {
        'stats.tagCount': FieldValue.increment(-1),
      });
    }
    await batch.commit();

    logger.info('Post removed', { postId, uid: user.uid });
    return { ok: true };
  },
);
