import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTIONS, ids, type Like, type Post, type PostSave } from '@loane/shared';
import { notify } from '../bookings/transitions';
import { db, now, FieldValue } from '../lib/admin';
import { invalidArgument, notFound } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import { assertNotBlocked } from '../moderation/block';

/**
 * Likes and saves on a post.
 *
 * Both drive a visible count, so neither is writable from the app — same
 * reasoning as follows and listing saves. The edge id is
 * `{uid}_{postId}`, which makes a double like impossible by construction,
 * and the transaction only moves the counter when the edge actually
 * changes, so a double tap cannot count twice.
 */

interface PostInput {
  postId: string;
}

async function setEdge(
  request: CallableRequest<PostInput>,
  kind: 'like' | 'save',
  on: boolean,
): Promise<{ on: boolean }> {
  const user = await requireActiveUser(request);
  const postId = request.data?.postId;
  if (!postId) throw invalidArgument('Which look?');

  const postRef = db().collection(COLLECTIONS.posts).doc(postId);
  const edgeRef =
    kind === 'like'
      ? db().collection(COLLECTIONS.likes).doc(ids.like(user.uid, postId))
      : db().collection(COLLECTIONS.postSaves).doc(ids.postSave(user.uid, postId));

  /*
    Captured from inside the transaction so the alert can be sent after
    it commits. Null when nothing changed — tapping like twice must not
    send two notifications.
  */
  let notifyAuthorUid: string | null = null;

  await db().runTransaction(async (tx) => {
    const [postSnap, edgeSnap] = await Promise.all([tx.get(postRef), tx.get(edgeRef)]);
    if (!postSnap.exists) throw notFound('That post is gone.');

    if (edgeSnap.exists === on) return;

    const post = postSnap.data() as Post;
    // A like sends the author a notification, so it is contact — refused
    // between blocked people like a comment or a follow. Taking a like
    // back, and saving (which is private), stay allowed.
    if (on && kind === 'like' && post.authorUid !== user.uid) {
      await assertNotBlocked(user.uid, post.authorUid);
    }
    const counter = kind === 'like' ? 'stats.likeCount' : 'stats.saveCount';

    // "Liked by Harper and others" — written here so the feed does not
    // pay a likes query and a profile read per post just to show a name.
    const likerPatch: Record<string, unknown> = {};
    if (kind === 'like') {
      if (on) {
        likerPatch.lastLiker = {
          uid: user.uid,
          username: user.username,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          campusId: user.campusId,
          isVerified: user.isVerified,
        };
      } else if (post.lastLiker?.uid === user.uid) {
        // We do not know who liked it before her, so show the count alone.
        likerPatch.lastLiker = null;
      }
    }

    if (on) {
      if (kind === 'like') {
        const like: Like = {
          id: edgeRef.id,
          uid: user.uid,
          postId,
          postAuthorUid: post.authorUid,
          campusId: post.campusId,
          createdAt: now() as never,
        };
        tx.set(edgeRef, like);
      } else {
        const save: PostSave = {
          id: edgeRef.id,
          uid: user.uid,
          postId,
          campusId: post.campusId,
          createdAt: now() as never,
        };
        tx.set(edgeRef, save);
      }
      tx.update(postRef, { [counter]: FieldValue.increment(1), ...likerPatch });
      // Likes only. A save is private — she is not telling the author
      // she bookmarked it.
      if (kind === 'like' && post.authorUid !== user.uid) notifyAuthorUid = post.authorUid;
    } else {
      tx.delete(edgeRef);
      tx.update(postRef, { [counter]: FieldValue.increment(-1), ...likerPatch });
    }
  });

  /*
    After the commit, not inside it: an alert that fails must not undo
    the like she actually made.
  */
  if (notifyAuthorUid) {
    const batch = db().batch();
    notify(batch, {
      uid: notifyAuthorUid,
      type: 'post_liked',
      title: `@${user.username} liked your look`,
      body: 'Tap to see it.',
      postId,
      actor: { uid: user.uid, username: user.username, photoUrl: user.photoUrl },
    });
    await batch.commit();
  }

  return { on };
}

export const likePost = onCall<PostInput, Promise<{ on: boolean }>>(
  { region: 'us-central1' },
  (r) => setEdge(r, 'like', true),
);
export const unlikePost = onCall<PostInput, Promise<{ on: boolean }>>(
  { region: 'us-central1' },
  (r) => setEdge(r, 'like', false),
);
export const savePost = onCall<PostInput, Promise<{ on: boolean }>>(
  { region: 'us-central1' },
  (r) => setEdge(r, 'save', true),
);
export const unsavePost = onCall<PostInput, Promise<{ on: boolean }>>(
  { region: 'us-central1' },
  (r) => setEdge(r, 'save', false),
);
