import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { COLLECTIONS } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import type { Conversation, Message } from '@loane/shared';

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
        body: message.body.slice(0, 140),
        senderUid: message.senderUid,
        sentAt: now(),
      },
      updatedAt: now(),
    };
    for (const uid of recipients) {
      patch[`unreadCounts.${uid}`] = FieldValue.increment(1);
    }

    await ref.update(patch);
  },
);
