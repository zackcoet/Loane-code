import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { COLLECTIONS, LIKED_MESSAGE_PREVIEW, likeInboxUpdate } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import type { Conversation, Message } from '@loane/shared';

/**
 * When someone hearts a message, the inbox says so — "Liked a message"
 * as the preview, and one unread for the person whose message it was —
 * the way Instagram does.
 *
 * A trigger for the same reason as onMessageCreated: the heart itself is
 * written by the app so it appears instantly, and the summary catches up
 * a moment later. The phone cannot write the preview or anyone's badge;
 * only this can. See likeInboxUpdate for what counts.
 */
export const onMessageLiked = onDocumentUpdated(
  {
    document: `${COLLECTIONS.conversations}/{conversationId}/messages/{messageId}`,
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data?.before.data() as Message | undefined;
    const after = event.data?.after.data() as Message | undefined;
    if (!before || !after || after.isDeleted) return;
    // Most message updates are read marks, not hearts. Bail out before
    // reading the thread unless a new heart actually arrived.
    if (!likeInboxUpdate(before.likedBy, after.likedBy, after.senderUid, null)) return;

    const ref = db().collection(COLLECTIONS.conversations).doc(event.params.conversationId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const conversation = snap.data() as Conversation;

    const update = likeInboxUpdate(
      before.likedBy,
      after.likedBy,
      after.senderUid,
      conversation.lastMessage,
    );
    if (!update) return;

    const patch: Record<string, unknown> = {
      lastMessage: {
        body: LIKED_MESSAGE_PREVIEW,
        senderUid: update.likerUid,
        sentAt: now(),
      },
      updatedAt: now(),
    };
    if (update.bumpUnread) {
      patch[`unreadCounts.${after.senderUid}`] = FieldValue.increment(1);
    }
    await ref.update(patch);
  },
);
