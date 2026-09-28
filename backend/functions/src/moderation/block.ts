import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';

/**
 * Blocking.
 *
 * TWO HALVES, AND THEY ARE NOT EQUALLY STRONG. Worth understanding
 * before trusting it — the honest version is in docs/security.md.
 *
 *   ACTIONS are genuinely enforced. Messaging, renting and following
 *   between two people where either has blocked the other are refused
 *   here on the server. A modified app cannot get around it.
 *
 *   CONTENT is filtered on the phone. Hiding her posts from your feed
 *   means your app skips them. Firestore cannot express "everything on
 *   my campus except these fourteen people", and the alternative is a
 *   per-user fan-out feed.
 *
 * So someone technical who blocked you could still see your public posts
 * if they went out of their way. Nobody casually will, and the things
 * that actually hurt are properly blocked.
 *
 * The block is written in two places: under the blocker, and as a
 * reverse marker under the person blocked. The reverse copy is what
 * lets HER app hide HIM too — without it, blocking would be one-way in
 * practice. Nothing in the UI ever tells someone they were blocked; her
 * app just quietly filters.
 */

interface BlockInput {
  uid: string;
}

/** Has either person blocked the other? */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const [aBlockedB, bBlockedA] = await Promise.all([
    db().collection(COLLECTIONS.users).doc(a).collection('blocked').doc(b).get(),
    db().collection(COLLECTIONS.users).doc(b).collection('blocked').doc(a).get(),
  ]);
  return aBlockedB.exists || bBlockedA.exists;
}

/** Throws if either person has blocked the other. */
export async function assertNotBlocked(a: string, b: string): Promise<void> {
  if (await isBlockedEitherWay(a, b)) {
    // Deliberately vague. Telling one side "she blocked you" turns a
    // quiet boundary into a confrontation.
    throw failed('That is not available.');
  }
}

export const blockUser = onCall<BlockInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<BlockInput>): Promise<{ ok: true }> => {
    const me = await requireActiveUser(request);
    const targetUid = request.data?.uid;
    if (!targetUid) throw invalidArgument('Who do you want to block?');
    if (targetUid === me.uid) throw failed("You can't block yourself.");

    const target = await db().collection(COLLECTIONS.users).doc(targetUid).get();
    if (!target.exists) throw notFound('We could not find that student.');

    const batch = db().batch();
    batch.set(
      db().collection(COLLECTIONS.users).doc(me.uid).collection('blocked').doc(targetUid),
      { blockedUid: targetUid, createdAt: now() },
    );
    // The reverse marker, so her app can hide him too.
    batch.set(
      db().collection(COLLECTIONS.users).doc(targetUid).collection('blockedBy').doc(me.uid),
      { blockerUid: me.uid, createdAt: now() },
    );

    // Following each other stops making sense the moment one blocks.
    const edges = [
      db().collection(COLLECTIONS.follows).doc(`${me.uid}_${targetUid}`),
      db().collection(COLLECTIONS.follows).doc(`${targetUid}_${me.uid}`),
    ];
    const existing = await Promise.all(edges.map((ref) => ref.get()));
    existing.forEach((snap, index) => {
      if (!snap.exists) return;
      batch.delete(edges[index]!);
      const followerUid = index === 0 ? me.uid : targetUid;
      const followingUid = index === 0 ? targetUid : me.uid;
      batch.update(db().collection(COLLECTIONS.users).doc(followerUid), {
        'stats.followingCount': FieldValue.increment(-1),
      });
      batch.update(db().collection(COLLECTIONS.users).doc(followingUid), {
        'stats.followerCount': FieldValue.increment(-1),
      });
    });

    await batch.commit();
    logger.info('User blocked', { by: me.uid, target: targetUid });
    return { ok: true };
  },
);

export const unblockUser = onCall<BlockInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<BlockInput>): Promise<{ ok: true }> => {
    const me = await requireActiveUser(request);
    const targetUid = request.data?.uid;
    if (!targetUid) throw invalidArgument('Who do you want to unblock?');

    const batch = db().batch();
    batch.delete(
      db().collection(COLLECTIONS.users).doc(me.uid).collection('blocked').doc(targetUid),
    );
    batch.delete(
      db().collection(COLLECTIONS.users).doc(targetUid).collection('blockedBy').doc(me.uid),
    );
    await batch.commit();

    return { ok: true };
  },
);
