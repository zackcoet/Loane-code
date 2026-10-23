import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { COLLECTIONS, ids, type Comment, type CommentLike } from '@loane/shared';
import { notify } from '../bookings/transitions';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import { assertNotBlocked } from '../moderation/block';

/**
 * Hearts on comments.
 *
 * The same shape as post likes (social/postEngagement.ts): the edge id
 * is `{uid}_{commentId}`, so a double like is impossible by
 * construction, and the count on the comment moves only when the edge
 * actually changes, so a double tap cannot count twice.
 */

interface CommentInput {
  commentId: string;
}

async function setCommentLike(
  request: CallableRequest<CommentInput>,
  on: boolean,
): Promise<{ on: boolean }> {
  const user = await requireActiveUser(request);
  const commentId = request.data?.commentId;
  if (!commentId) throw invalidArgument('Which comment?');

  const commentRef = db().collection(COLLECTIONS.comments).doc(commentId);
  const edgeRef = db()
    .collection(COLLECTIONS.commentLikes)
    .doc(ids.commentLike(user.uid, commentId));

  // Read inside the transaction, sent after it commits. Null when
  // nothing changed — a second heart must not send a second alert.
  let alert: { uid: string; postId: string; body: string } | null = null;

  await db().runTransaction(async (tx) => {
    const [commentSnap, edgeSnap] = await Promise.all([tx.get(commentRef), tx.get(edgeRef)]);
    if (!commentSnap.exists) throw notFound('That comment is gone.');
    if (edgeSnap.exists === on) return;

    const comment = commentSnap.data() as Comment;

    if (on) {
      // Taking a heart back off a removed comment is fine; adding one is not.
      if (comment.status !== 'active') throw failed('That comment is no longer there.');
      // A heart alerts the commenter, so it is contact — refused between
      // blocked people, like a post like.
      if (comment.authorUid !== user.uid) await assertNotBlocked(user.uid, comment.authorUid);

      const like: CommentLike = {
        id: edgeRef.id,
        uid: user.uid,
        commentId,
        postId: comment.postId,
        commentAuthorUid: comment.authorUid,
        campusId: comment.campusId,
        createdAt: now() as never,
      };
      tx.set(edgeRef, like);
      tx.update(commentRef, { likeCount: FieldValue.increment(1) });
      if (comment.authorUid !== user.uid) {
        alert = {
          uid: comment.authorUid,
          postId: comment.postId,
          body: comment.body.length > 80 ? `${comment.body.slice(0, 77)}…` : comment.body,
        };
      }
    } else {
      tx.delete(edgeRef);
      // Never below zero, even on a comment whose count predates likes.
      if ((comment.likeCount ?? 0) > 0) {
        tx.update(commentRef, { likeCount: FieldValue.increment(-1) });
      }
    }
  });

  const sent = alert as { uid: string; postId: string; body: string } | null;
  if (sent) {
    const batch = db().batch();
    notify(batch, {
      uid: sent.uid,
      type: 'comment_liked',
      title: `@${user.username} liked your comment`,
      body: sent.body,
      postId: sent.postId,
      actor: { uid: user.uid, username: user.username, photoUrl: user.photoUrl },
    });
    await batch.commit();
  }

  return { on };
}

export const likeComment = onCall<CommentInput, Promise<{ on: boolean }>>(
  { region: 'us-central1' },
  (r) => setCommentLike(r, true),
);
export const unlikeComment = onCall<CommentInput, Promise<{ on: boolean }>>(
  { region: 'us-central1' },
  (r) => setCommentLike(r, false),
);
