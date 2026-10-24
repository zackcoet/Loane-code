import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, LIMITS, type Post } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { rateLimit } from '../lib/rateLimit';
import { isBlockedEitherWay } from '../moderation/block';
import { cleanNote, cleanRecipients, sendToEach } from './sendToEach';

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
 * Anyone she cannot message is skipped quietly — see sendToEach.
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
    const note = cleanNote(request.data?.note);

    const toUids = cleanRecipients(request.data?.toUids, me.uid);

    if (!postId || typeof postId !== 'string') throw invalidArgument('Which look?');
    if (toUids.length === 0) throw invalidArgument('Pick someone to send it to.');
    if (toUids.length > LIMITS.sharePostRecipients.max) {
      throw invalidArgument(`You can send to ${LIMITS.sharePostRecipients.max} people at a time.`);
    }
    if (note.length > LIMITS.messageBody.max) throw invalidArgument('That note is too long.');
    await rateLimit(me.uid, 'share');

    const postSnap = await db().collection(COLLECTIONS.posts).doc(postId).get();
    if (!postSnap.exists) throw notFound('That look is gone.');
    const post = postSnap.data() as Post;
    if (post.status !== 'active') throw failed('That look is no longer up.');
    if (post.settings?.sharingDisabled === true)
      throw failed('Sharing is turned off for that look.');
    // Blocked either way: the same answer as a look that is gone, so a
    // share never reveals a block.
    if (post.authorUid !== me.uid && (await isBlockedEitherWay(me.uid, post.authorUid))) {
      throw notFound('That look is gone.');
    }

    // The snapshot that goes in the bubble. Stored rather than looked up
    // so the chat renders instantly and does not turn into a blank card
    // if the post later comes down.
    const sharedPost = {
      postId,
      photoUrl: post.photos?.[0]?.url ?? null,
      caption: (post.caption ?? '').slice(0, 140),
      authorUsername: post.author.username,
    };

    const { sentTo, lastConversationId } = await sendToEach(
      me,
      toUids,
      { body: note, sharedPost, sharedListing: null },
      post.authorUid,
    );

    if (sentTo === 0) throw failed('We could not send that to anyone you picked.');

    await postSnap.ref.update({
      'stats.shareCount': FieldValue.increment(sentTo),
      updatedAt: now(),
    });

    logger.info('Look shared', { postId, sentTo });
    return { sentTo, conversationId: sentTo === 1 ? lastConversationId : null };
  },
);
