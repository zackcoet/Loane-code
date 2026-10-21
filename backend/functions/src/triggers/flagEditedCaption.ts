import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { COLLECTIONS, type Post } from '@loane/shared';
import { db } from '../lib/admin';
import { queueAutoFlag } from '../moderation/autoFlag';

/**
 * Runs the content filter over a caption she edits.
 *
 * New looks are checked inside createPost, but editing a caption is a
 * direct write from the app (edit-post.tsx), so without this a caption
 * could be posted clean and changed afterwards. Only fires when the
 * caption actually changed. The event id makes a retried run file the
 * same report rather than a second one.
 */
export const flagEditedCaption = onDocumentUpdated(
  { document: `${COLLECTIONS.posts}/{postId}`, region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() as Post | undefined;
    const after = event.data?.after.data() as Post | undefined;
    if (!before || !after || before.caption === after.caption) return;

    const batch = db().batch();
    const flagged = queueAutoFlag(batch, {
      targetType: 'post',
      targetId: event.params.postId,
      targetUid: after.authorUid,
      campusId: after.campusId,
      text: after.caption,
      idSuffix: `edit_${event.id}`,
    });
    if (flagged) await batch.commit();
  },
);
