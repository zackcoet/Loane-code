import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { COLLECTIONS, messagePreview, previewMovesForward } from '@loane/shared';
import { db, now, FieldValue, Timestamp } from '../lib/admin';
import type { Conversation, Message } from '@loane/shared';
import { queueAutoFlag } from '../moderation/autoFlag';
import { eventMillis } from '../lib/eventTime';

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
    const messageId = event.params.messageId;
    const ref = db().collection(COLLECTIONS.conversations).doc(conversationId);
    // When the message reached the server — the moment Firestore saved
    // it, not when this job got round to it, and not whatever time a
    // phone wrote on it.
    const sentMs = eventMillis(event.time);

    /*
      IN A TRANSACTION, because two messages a second apart are two runs
      of this job at once. Each used to read the thread, then write its
      own preview: the older message could land last and sit in the
      inbox under the newer one. Now the preview only moves forward, and
      the unread counts still go up by one per message.
    */
    const conversation = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const thread = snap.data() as Conversation;

      // The same message delivered to this job twice (it happens) must
      // not count as two unread.
      if (thread.lastMessage?.messageId === messageId) return null;

      const recipients = thread.participantUids.filter((uid) => uid !== message.senderUid);
      const patch: Record<string, unknown> = {
        // Who has ever written here. A thread a stranger started stays a
        // message request for her until she answers — see isRequestFor.
        // A thread that already had messages before this field existed
        // counts both people as having written, so a long-running chat
        // never turns into a "request" the next time someone speaks.
        repliedUids:
          !thread.repliedUids && thread.lastMessage
            ? thread.participantUids
            : FieldValue.arrayUnion(message.senderUid),
      };
      if (previewMovesForward(thread.lastMessage, sentMs)) {
        patch.lastMessage = {
          // A photo, a look or a piece with no words still needs a
          // preview, or the inbox row reads as an empty message.
          body: messagePreview(message),
          senderUid: message.senderUid,
          sentAt: Timestamp.fromMillis(sentMs),
          messageId,
        };
        patch.updatedAt = now();
      }
      for (const uid of recipients) {
        patch[`unreadCounts.${uid}`] = FieldValue.increment(1);
      }
      tx.update(ref, patch);
      return thread;
    });
    if (!conversation) return;

    // The words go to an admin on a match; the message is sent either
    // way. The report's id is fixed per message, so a second run of this
    // job files the same report rather than another.
    const batch = db().batch();
    const queued = queueAutoFlag(batch, {
      targetType: 'message',
      targetId: `${conversationId}/${messageId}`,
      targetUid: message.senderUid,
      campusId: conversation.campusId,
      text: message.body,
    });
    if (queued) await batch.commit();
  },
);
