import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTIONS, ids, type Like, type Post, type PostSave } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { invalidArgument, notFound } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';

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

  await db().runTransaction(async (tx) => {
    const [postSnap, edgeSnap] = await Promise.all([tx.get(postRef), tx.get(edgeRef)]);
    if (!postSnap.exists) throw notFound('That post is gone.');

    if (edgeSnap.exists === on) return;

    const post = postSnap.data() as Post;
    const counter = kind === 'like' ? 'stats.likeCount' : 'stats.saveCount';

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
      tx.update(postRef, { [counter]: FieldValue.increment(1) });
    } else {
      tx.delete(edgeRef);
      tx.update(postRef, { [counter]: FieldValue.increment(-1) });
    }
  });

  // TODO-PHASE6: notify the author of a new like.
  return { on };
}

export const likePost = onCall<PostInput, Promise<{ on: boolean }>>({ region: 'us-central1' }, (r) =>
  setEdge(r, 'like', true),
);
export const unlikePost = onCall<PostInput, Promise<{ on: boolean }>>(
  { region: 'us-central1' },
  (r) => setEdge(r, 'like', false),
);
export const savePost = onCall<PostInput, Promise<{ on: boolean }>>({ region: 'us-central1' }, (r) =>
  setEdge(r, 'save', true),
);
export const unsavePost = onCall<PostInput, Promise<{ on: boolean }>>(
  { region: 'us-central1' },
  (r) => setEdge(r, 'save', false),
);
