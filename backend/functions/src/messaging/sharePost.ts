import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, LIMITS, SUBCOLLECTIONS, type Message, type Post, type User } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { isBlockedEitherWay } from '../moderation/block';
import { ensureConversation } from './openConversation';

/**
 * `sharePost`
 *
 * Sending a look to people in chat.
 *
 * A function rather than a normal message write, for three reasons:
 * it may have to create several threads at once, it moves the post's
 * share count, and the snapshot of the post stamped into the bubble has
 * to be the real post rather than whatever the phone claims it is.
 *
 * Anyone she cannot message is skipped rather than failing the whole
 * send. Sending to five friends and getting an error because one of
 * them blocked her would tell her something about that person that she
 * is not entitled to know.
 */

interface ShareInput {
  postId: string;
  toUids: string[];
  /** An optional line of her own, sent with it. */
  note?: string;
}

interface ShareResult {
  /** How many threads it actually landed in. */
  sentTo: number;
  /** The thread to open when she sent it to exactly one person. */
  conversationId: string | null;
}

export const sharePost = onCall<ShareInput, Promise<ShareResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<ShareInput>): Promise<ShareResult> => {
    const me = await requireVerifiedStudent(request);
    const postId = request.data?.postId;
    const note = (request.data?.note ?? '').trim();

    // Deduplicated, and never to herself — a look in her own chat with
    // herself is not a thing.
    const toUids = Array.from(new Set(request.data?.toUids ?? [])).filter((u) => u !== me.uid);

    if (!postId) throw invalidArgument('Which look?');
    if (toUids.length === 0) throw invalidArgument('Pick someone to send it to.');
    if (toUids.length > LIMITS.sharePostRecipients.max) {
      throw invalidArgument(`You can send to ${LIMITS.sharePostRecipients.max} people at a time.`);
    }
    if (note.length > LIMITS.messageBody.max) throw invalidArgument('That note is too long.');

    const postSnap = await db().collection(COLLECTIONS.posts).doc(postId).get();
    if (!postSnap.exists) throw notFound('That look is gone.');
    const post = postSnap.data() as Post;
    if (post.status !== 'active') throw failed('That look is no longer up.');

    // The snapshot that goes in the bubble. Stored rather than looked up
    // so the chat renders instantly and does not turn into a blank card
    // if the post later comes down.
    const sharedPost = {
      postId,
      photoUrl: post.photos?.[0]?.url ?? null,
      caption: (post.caption ?? '').slice(0, 140),
      authorUsername: post.author.username,
    };

    let sentTo = 0;
    let lastConversationId: string | null = null;

    for (const uid of toUids) {
      const themSnap = await db().collection(COLLECTIONS.users).doc(uid).get();
      if (!themSnap.exists) continue;
      const them = themSnap.data() as User;
      if (them.status !== 'active') continue;
      if (await isBlockedEitherWay(me.uid, uid)) continue;

      const conversationId = await ensureConversation(me, them);
      const message: Omit<Message, 'createdAt' | 'updatedAt'> = {
        id: '',
        conversationId,
        senderUid: me.uid,
        body: note,
        photo: null,
        sharedPost,
        readBy: [me.uid],
        isDeleted: false,
      };

      const ref = db()
        .collection(COLLECTIONS.conversations)
        .doc(conversationId)
        .collection(SUBCOLLECTIONS.messages)
        .doc();
      // onMessageCreated picks it up from here and moves the thread
      // preview and the other person's unread badge.
      await ref.set({ ...message, id: ref.id, createdAt: now(), updatedAt: now() });

      sentTo += 1;
      lastConversationId = conversationId;
    }

    if (sentTo === 0) throw failed('We could not send that to anyone you picked.');

    await postSnap.ref.update({
      'stats.shareCount': FieldValue.increment(sentTo),
      updatedAt: now(),
    });

    logger.info('Look shared', { postId, sentTo });
    return { sentTo, conversationId: sentTo === 1 ? lastConversationId : null };
  },
);
