import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { COLLECTIONS, messagePreview } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import type { Conversation, Message } from '@loane/shared';
import { queueAutoFlag } from '../moderation/autoFlag';

/**
 * Keeps a conversation's preview and unread badge up to date.
 *
 * A trigger rather than a callable, deliberately: sending a message is
 * the one thing in the app that has to feel instant. The app writes the
 * message straight to Firestore — it appears in both people's threads
 * immediately over the realtime listener — and this tidies up the
 * summary a moment later. Routing the send through a function would add
 * a round trip to every single message.
 */

export const onMessageCreated = onDocumentCreated(
  {
    document: `${COLLECTIONS.conversations}/{conversationId}/messages/{messageId}`,
    region: 'us-central1',
  },
  async (event) => {
    const message = event.data?.data() as Message | undefined;
    if (!message) return;

    const conversationId = event.params.conversationId;
    const ref = db().collection(COLLECTIONS.conversations).doc(conversationId);
    const snap = await ref.get();
    if (!snap.exists) return;

    const conversation = snap.data() as Conversation;
    const recipients = conversation.participantUids.filter((uid) => uid !== message.senderUid);

    const patch: Record<string, unknown> = {
      lastMessage: {
        // A photo, a look or a piece with no words still needs a
        // preview, or the inbox row reads as an empty message.
        body: messagePreview(message),
        senderUid: message.senderUid,
        sentAt: now(),
      },
      // Who has ever written here. A thread a stranger started stays a
      // message request for her until she answers — see isRequestFor.
      // A thread that already had messages before this field existed
      // counts both people as having written, so a long-running chat
      // never turns into a "request" the next time someone speaks.
      repliedUids:
        !conversation.repliedUids && conversation.lastMessage
          ? conversation.participantUids
          : FieldValue.arrayUnion(message.senderUid),
      updatedAt: now(),
    };
    for (const uid of recipients) {
      patch[`unreadCounts.${uid}`] = FieldValue.increment(1);
    }

    // The words go to an admin on a match; the message is sent either way.
    const batch = db().batch();
    batch.update(ref, patch);
    queueAutoFlag(batch, {
      targetType: 'message',
      targetId: `${conversationId}/${event.params.messageId}`,
      targetUid: message.senderUid,
      campusId: conversation.campusId,
      text: message.body,
    });
    await batch.commit();
  },
);
