import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, ids, type Follow } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';

/**
 * `follow` and `unfollow`.
 *
 * The app cannot write the `follows` collection or anyone's follower count
 * — the security rules forbid both. If it could, follower counts would be
 * fiction, and on a social app that number is part of the trust signal.
 *
 * The edge document id is `{followerUid}_{followingUid}`, so following
 * twice is impossible by construction rather than something we check for.
 * Both functions read the edge inside a transaction and only move the
 * counters when the edge actually changes, which keeps a double tap from
 * counting twice.
 */

interface FollowInput {
  /** The uid being followed. */
  uid: string;
}

interface FollowResult {
  following: boolean;
}

async function setFollow(
  request: CallableRequest<FollowInput>,
  shouldFollow: boolean,
): Promise<FollowResult> {
  const me = await requireVerifiedStudent(request);
  const targetUid = request.data?.uid;

  if (!targetUid) throw invalidArgument('Who do you want to follow?');
  if (targetUid === me.uid) throw failed("You can't follow yourself.");

  const targetRef = db().collection(COLLECTIONS.users).doc(targetUid);
  const meRef = db().collection(COLLECTIONS.users).doc(me.uid);
  const edgeRef = db().collection(COLLECTIONS.follows).doc(ids.follow(me.uid, targetUid));

  await db().runTransaction(async (tx) => {
    const [targetSnap, edgeSnap] = await Promise.all([tx.get(targetRef), tx.get(edgeRef)]);
    if (!targetSnap.exists) throw notFound('We could not find that closet.');

    const alreadyFollowing = edgeSnap.exists;
    // Nothing to do — tapping follow twice must not count twice.
    if (alreadyFollowing === shouldFollow) return;

    if (shouldFollow) {
      const edge: Follow = {
        id: edgeRef.id,
        followerUid: me.uid,
        followingUid: targetUid,
        campusId: me.campusId,
        createdAt: now() as never,
      };
      tx.set(edgeRef, edge);
      tx.update(meRef, { 'stats.followingCount': FieldValue.increment(1), updatedAt: now() });
      tx.update(targetRef, { 'stats.followerCount': FieldValue.increment(1), updatedAt: now() });
    } else {
      tx.delete(edgeRef);
      tx.update(meRef, { 'stats.followingCount': FieldValue.increment(-1), updatedAt: now() });
      tx.update(targetRef, { 'stats.followerCount': FieldValue.increment(-1), updatedAt: now() });
    }
  });

  logger.info(shouldFollow ? 'Followed' : 'Unfollowed', { from: me.uid, to: targetUid });

  // TODO-PHASE6: notify the person who was followed.
  return { following: shouldFollow };
}

export const follow = onCall<FollowInput, Promise<FollowResult>>({ region: 'us-central1' }, (r) =>
  setFollow(r, true),
);

export const unfollow = onCall<FollowInput, Promise<FollowResult>>({ region: 'us-central1' }, (r) =>
  setFollow(r, false),
);
