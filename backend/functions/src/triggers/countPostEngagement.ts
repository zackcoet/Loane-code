import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type AppEvent, type Post } from '@loane/shared';
import { db, FieldValue } from '../lib/admin';

/**
 * Moves the two post counters the app is not allowed to write.
 *
 *   post_view        -> post.stats.viewCount
 *   tagged_item_tap  -> post.stats.tagTapCount
 *
 * `tagTapCount` is the one that matters. It counts someone tapping a
 * tagged garment to go and look at renting it, which is the single most
 * direct answer to "does the social side drive the marketplace?" — MVP
 * question 2. Until now the event was logged and the counter never moved.
 *
 * Same rule as listing views: your own don't count.
 *
 * A tag tap carries the LISTING id as its target, because that is what
 * the tap opens. The post it came from travels in `meta.postId`, which is
 * what lets us credit the post as well.
 */

export const countPostEngagement = onDocumentCreated(
  { document: `${COLLECTIONS.events}/{eventId}`, region: 'us-central1' },
  async (event) => {
    const data = event.data?.data() as AppEvent | undefined;
    if (!data) return;

    const isView = data.type === 'post_view';
    const isTagTap = data.type === 'tagged_item_tap';
    if (!isView && !isTagTap) return;

    const postId = isView ? data.targetId : (data.meta?.postId as string | undefined);
    if (!postId) return;

    const ref = db().collection(COLLECTIONS.posts).doc(postId);
    const snap = await ref.get();
    if (!snap.exists) return;

    // The author browsing her own look is not engagement.
    if ((snap.data() as Post).authorUid === data.uid) return;

    await ref.update({
      [isView ? 'stats.viewCount' : 'stats.tagTapCount']: FieldValue.increment(1),
    });
    logger.debug('Counted post engagement', { postId, type: data.type });
  },
);
