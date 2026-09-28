import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import {
  COLLECTIONS,
  LIMITS,
  type Comment,
  type Post,
  type UserSummary,
} from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound, permissionDenied } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { assertNotBlocked } from '../moderation/block';

/**
 * Comments on a look.
 *
 * Written by functions rather than by the app for the usual two
 * reasons. The count under the post has to be right, and the name and
 * photo stamped on the comment have to be really hers — if the app
 * could write those, anyone could leave a comment signed by somebody
 * else.
 *
 * Deleting is a soft delete. A comment somebody reported has to still
 * exist when an admin goes looking for it, so `status` moves to
 * `removed` and the row stays.
 */

interface AddInput {
  postId: string;
  body: string;
  /** Answering another comment. One level deep, never more. */
  parentCommentId?: string;
}

interface DeleteInput {
  commentId: string;
}

function summarize(user: {
  uid: string;
  username: string;
  displayName: string;
  photoUrl: string | null;
  campusId: string;
  isVerified: boolean;
}): UserSummary {
  return {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    campusId: user.campusId,
    isVerified: user.isVerified,
  };
}

export const addComment = onCall<AddInput, Promise<{ commentId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<AddInput>) => {
    const user = await requireVerifiedStudent(request);
    const postId = request.data?.postId;
    const body = (request.data?.body ?? '').trim();
    const parentCommentId = request.data?.parentCommentId ?? null;

    if (!postId) throw invalidArgument('Which look?');
    if (body.length < LIMITS.commentBody.min) throw invalidArgument('Say something first.');
    if (body.length > LIMITS.commentBody.max) throw invalidArgument('That comment is too long.');

    const postRef = db().collection(COLLECTIONS.posts).doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) throw notFound('That look is gone.');

    const post = postSnap.data() as Post;
    if (post.status !== 'active') throw failed('That look is no longer up.');

    // Blocking has to hold here too. Someone she blocked turning up in
    // her comments is exactly what blocking is supposed to prevent.
    await assertNotBlocked(user.uid, post.authorUid);

    // A reply has to answer a real, still-visible, top-level comment on
    // THIS post. The last check is what keeps the thread one level
    // deep: you cannot reply to a reply.
    if (parentCommentId) {
      const parentSnap = await db()
        .collection(COLLECTIONS.comments)
        .doc(parentCommentId)
        .get();
      if (!parentSnap.exists) throw notFound('That comment is gone.');
      const parent = parentSnap.data() as Comment;
      if (parent.postId !== postId) throw invalidArgument('That comment is on another look.');
      if (parent.status !== 'active') throw failed('That comment is no longer there.');
      if (parent.parentCommentId) {
        throw invalidArgument('You can reply to a comment, but not to a reply.');
      }
    }

    const ref = db().collection(COLLECTIONS.comments).doc();
    const comment: Omit<Comment, 'createdAt' | 'updatedAt'> = {
      id: ref.id,
      campusId: post.campusId,
      postId,
      authorUid: user.uid,
      author: summarize(user),
      body,
      parentCommentId,
      status: 'active',
      suspendedReason: null,
    };

    const batch = db().batch();
    batch.set(ref, { ...comment, createdAt: now(), updatedAt: now() });
    batch.update(postRef, {
      'stats.commentCount': FieldValue.increment(1),
      updatedAt: now(),
    });
    await batch.commit();

    // TODO-PHASE7: notify the author of a new comment once push exists.
    return { commentId: ref.id };
  },
);

export const deleteComment = onCall<DeleteInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<DeleteInput>) => {
    const user = await requireVerifiedStudent(request);
    const commentId = request.data?.commentId;
    if (!commentId) throw invalidArgument('Which comment?');

    const ref = db().collection(COLLECTIONS.comments).doc(commentId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('That comment is gone.');

    const comment = snap.data() as Comment;

    // Her own comment, or a comment on her own look. The second one
    // matters: the person whose post it is should be able to clear
    // something nasty off it without waiting for us.
    const postSnap = await db().collection(COLLECTIONS.posts).doc(comment.postId).get();
    const postAuthorUid = postSnap.exists ? (postSnap.data() as Post).authorUid : null;
    if (comment.authorUid !== user.uid && postAuthorUid !== user.uid) {
      throw permissionDenied('That is not yours to delete.');
    }

    // Already gone. Say so rather than moving the count a second time.
    if (comment.status !== 'active') throw failed('That comment is already gone.');

    const batch = db().batch();
    batch.update(ref, { status: 'removed', updatedAt: now() });
    if (postSnap.exists) {
      batch.update(postSnap.ref, {
        'stats.commentCount': FieldValue.increment(-1),
        updatedAt: now(),
      });
    }
    await batch.commit();

    return { ok: true };
  },
);
