import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import {
  COLLECTIONS,
  extractMentions,
  LIMITS,
  type Comment,
  type NotificationType,
  type Post,
  type User,
  type UserSummary,
} from '@loane/shared';
import { notify } from '../bookings/transitions';
import { db, now, FieldValue } from '../lib/admin';
import { rateLimit } from '../lib/rateLimit';
import { failed, invalidArgument, notFound, permissionDenied } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { queueAutoFlag } from '../moderation/autoFlag';
import { assertNotBlocked, isBlockedEitherWay } from '../moderation/block';

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
    await rateLimit(user.uid, 'comment');
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
    if (post.settings?.commentsDisabled) throw failed('Comments are turned off for this look.');

    // Blocking has to hold here too. Someone she blocked turning up in
    // her comments is exactly what blocking is supposed to prevent.
    await assertNotBlocked(user.uid, post.authorUid);

    // A reply has to answer a real, still-visible, top-level comment on
    // THIS post. The last check is what keeps the thread one level
    // deep: you cannot reply to a reply.
    let parentAuthorUid: string | null = null;
    if (parentCommentId) {
      const parentSnap = await db().collection(COLLECTIONS.comments).doc(parentCommentId).get();
      if (!parentSnap.exists) throw notFound('That comment is gone.');
      const parent = parentSnap.data() as Comment;
      if (parent.postId !== postId) throw invalidArgument('That comment is on another look.');
      if (parent.status !== 'active') throw failed('That comment is no longer there.');
      if (parent.parentCommentId) {
        throw invalidArgument('You can reply to a comment, but not to a reply.');
      }
      // Replying is talking TO the commenter, so it is refused between
      // blocked people even on a third person's look.
      if (parent.authorUid !== user.uid) await assertNotBlocked(user.uid, parent.authorUid);
      parentAuthorUid = parent.authorUid;
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
    // Posted either way; a match only puts it in front of an admin.
    queueAutoFlag(batch, {
      targetType: 'comment',
      targetId: ref.id,
      targetUid: user.uid,
      campusId: post.campusId,
      text: body,
    });
    await batch.commit();

    // After the commit, so a failed alert cannot lose the comment.
    await sendCommentAlerts({
      user,
      post,
      postId,
      body,
      parentAuthorUid: parentAuthorUid,
    });

    return { commentId: ref.id };
  },
);

/**
 * Who hears about a new comment, and how. One alert per person at most,
 * most specific reason wins:
 *
 *   1. "replied to your comment" — the person she answered.
 *   2. "commented on your look"  — the look's author.
 *   3. "mentioned you"           — anyone she @tagged.
 *
 * So the author of a look who is also the person being answered gets
 * one alert (the reply), not two. Never to herself, and never to anyone
 * blocked either way — a mention must not become a way round a block.
 * Mentions only reach people on the look's campus, because that is
 * everyone who can see it.
 */
async function sendCommentAlerts(params: {
  user: User;
  post: Post;
  postId: string;
  body: string;
  parentAuthorUid: string | null;
}): Promise<void> {
  const { user, post, postId, body, parentAuthorUid } = params;
  const recipients = new Map<string, { type: NotificationType; title: string }>();
  const add = (uid: string, type: NotificationType, title: string) => {
    if (uid === user.uid || recipients.has(uid)) return;
    recipients.set(uid, { type, title });
  };

  if (parentAuthorUid) {
    add(parentAuthorUid, 'comment_replied', `@${user.username} replied to your comment`);
  }
  add(post.authorUid, 'post_commented', `@${user.username} commented on your look`);

  const handles = extractMentions(body).filter((h) => h !== user.username);
  if (handles.length > 0) {
    const snap = await db()
      .collection(COLLECTIONS.users)
      .where('campusId', '==', post.campusId)
      .where('username', 'in', handles)
      .get();
    for (const doc of snap.docs) {
      const mentioned = doc.data() as User;
      if (mentioned.status !== 'active') continue;
      // The look's author and the person answered already get a more
      // specific alert; checked here so they are not looked up twice.
      if (recipients.has(mentioned.uid) || mentioned.uid === user.uid) continue;
      if (await isBlockedEitherWay(user.uid, mentioned.uid)) continue;
      add(mentioned.uid, 'mentioned', `@${user.username} mentioned you in a comment`);
    }
  }

  if (recipients.size === 0) return;
  const batch = db().batch();
  for (const [uid, { type, title }] of recipients) {
    notify(batch, {
      uid,
      type,
      title,
      // The comment itself, trimmed — the whole point of a comment
      // alert is knowing whether it needs an answer.
      body: body.length > 80 ? `${body.slice(0, 77)}…` : body,
      postId,
      actor: { uid: user.uid, username: user.username, photoUrl: user.photoUrl },
    });
  }
  await batch.commit();
}

export const deleteComment = onCall<DeleteInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<DeleteInput>) => {
    const user = await requireVerifiedStudent(request);
    const commentId = request.data?.commentId;
    if (!commentId) throw invalidArgument('Which comment?');

    const ref = db().collection(COLLECTIONS.comments).doc(commentId);

    /*
      In a transaction so two deletes sent together (a double tap, or
      her and the look's author at the same moment) cannot both see it
      still active and take the look's comment count down twice.
    */
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw notFound('That comment is gone.');
      const comment = snap.data() as Comment;

      // Her own comment, or a comment on her own look. The second one
      // matters: the person whose post it is should be able to clear
      // something nasty off it without waiting for us.
      const postRef = db().collection(COLLECTIONS.posts).doc(comment.postId);
      const postSnap = await tx.get(postRef);
      const post = postSnap.exists ? (postSnap.data() as Post) : null;
      if (comment.authorUid !== user.uid && post?.authorUid !== user.uid) {
        throw permissionDenied('That is not yours to delete.');
      }

      // Already gone. Say so rather than moving the count a second time.
      if (comment.status !== 'active') throw failed('That comment is already gone.');

      tx.update(ref, { status: 'removed', updatedAt: now() });
      // Never below zero, even on a look whose count predates this check.
      if (post && (post.stats?.commentCount ?? 0) > 0) {
        tx.update(postRef, {
          'stats.commentCount': FieldValue.increment(-1),
          updatedAt: now(),
        });
      }
    });

    return { ok: true };
  },
);
