import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, ids, type Follow } from '@loane/shared';
import { notify } from '../bookings/transitions';
import { db, now, FieldValue } from '../lib/admin';
import { rateLimit } from '../lib/rateLimit';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { isDocId } from '../lib/input';

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
  await rateLimit(me.uid, 'follow');
  const targetUid = request.data?.uid;

  if (!isDocId(targetUid)) throw invalidArgument('Who do you want to follow?');
  if (targetUid === me.uid) throw failed("You can't follow yourself.");

  const targetRef = db().collection(COLLECTIONS.users).doc(targetUid);
  const meRef = db().collection(COLLECTIONS.users).doc(me.uid);
  const edgeRef = db().collection(COLLECTIONS.follows).doc(ids.follow(me.uid, targetUid));

  await db().runTransaction(async (tx) => {
    // The block is read INSIDE the transaction. Checked before it, a
    // block landing in between would be missed and the follow would
    // stand after it (blockUser removes follows in its own transaction).
    const [targetSnap, edgeSnap, iBlocked, theyBlocked] = await Promise.all([
      tx.get(targetRef),
      tx.get(edgeRef),
      tx.get(meRef.collection('blocked').doc(targetUid)),
      tx.get(targetRef.collection('blocked').doc(me.uid)),
    ]);
    if (!targetSnap.exists) throw notFound('We could not find that closet.');
    if (shouldFollow && (iBlocked.exists || theyBlocked.exists)) {
      // The same vague words as assertNotBlocked, on purpose.
      throw failed('That is not available.');
    }

    /*
      Nobody new follows a deleted or suspended account. A deleted one is
      a "Deleted account" shell that can never post again, and a stale
      profile or feed card could still offer the button — the follow
      would count, and the shell would get an alert nobody reads.

      Unfollowing always works, so she can tidy her list whatever has
      happened to the other account.
    */
    const targetStatus = (targetSnap.data() as { status?: string }).status;
    if (shouldFollow && (targetStatus === 'deactivated' || targetStatus === 'suspended')) {
      throw notFound('We could not find that closet.');
    }

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

  /*
    Only on follow, never on unfollow. Nobody needs to be told they
    have been unfollowed, and sending it would be unkind for no
    purpose.

    Outside the transaction: an alert failing must not undo the follow
    itself, which is the thing she actually asked for.
  */
  if (shouldFollow) {
    const batch = db().batch();
    notify(batch, {
      uid: targetUid,
      type: 'new_follower',
      title: `@${me.username} followed you`,
      body: 'Take a look at her closet.',
      deepLink: `/u/${me.username}?uid=${me.uid}`,
      actor: { uid: me.uid, username: me.username, photoUrl: me.photoUrl },
    });
    await batch.commit();
  }

  return { following: shouldFollow };
}

export const follow = onCall<FollowInput, Promise<FollowResult>>({ region: 'us-central1' }, (r) =>
  setFollow(r, true),
);

export const unfollow = onCall<FollowInput, Promise<FollowResult>>({ region: 'us-central1' }, (r) =>
  setFollow(r, false),
);
