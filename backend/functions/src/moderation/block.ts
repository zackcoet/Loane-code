import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, ids } from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import { isDocId } from '../lib/input';

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
    if (!isDocId(targetUid)) throw invalidArgument('Who do you want to block?');
    if (targetUid === me.uid) throw failed("You can't block yourself.");

    const users = db().collection(COLLECTIONS.users);
    const targetRef = users.doc(targetUid);
    const blockRef = users.doc(me.uid).collection('blocked').doc(targetUid);
    const reverseRef = users.doc(targetUid).collection('blockedBy').doc(me.uid);
    const edges = [
      db().collection(COLLECTIONS.follows).doc(ids.follow(me.uid, targetUid)),
      db().collection(COLLECTIONS.follows).doc(ids.follow(targetUid, me.uid)),
    ] as const;

    /*
      A transaction, not a plain batch: two taps on Block at the same
      moment would both see the follow and both take one off the
      follower counts. Inside a transaction the second one sees the
      follow already gone. Following reads the block inside its own
      transaction too (social/follow.ts), so a follow landing at the
      same instant as a block can't slip in after it.
    */
    try {
      await blockOnce();
    } catch (error) {
      // Two taps at the same moment fight over the same documents and
      // the database can give up on the loser (the emulator says
      // "Transaction is invalid or closed"). If the block is in place
      // and both follows are gone, the other tap did it — a success,
      // not "Something went wrong". Same as deleting a look.
      const done = await Promise.all([blockRef.get(), ...edges.map((ref) => ref.get())]).catch(
        () => null,
      );
      if (!done || !done[0]!.exists || done.slice(1).some((snap) => snap.exists)) throw error;
    }

    logger.info('User blocked', { by: me.uid, target: targetUid });
    return { ok: true };

    async function blockOnce(): Promise<void> {
      await db().runTransaction(async (tx) => {
        const [target, ...existing] = await Promise.all([
          tx.get(targetRef),
          ...edges.map((ref) => tx.get(ref)),
        ]);
        if (!target.exists) throw notFound('We could not find that student.');

        tx.set(blockRef, { blockedUid: targetUid, createdAt: now() });
        // The reverse marker, so her app can hide him too.
        tx.set(reverseRef, { blockerUid: me.uid, createdAt: now() });

        // Following each other stops making sense the moment one blocks.
        existing.forEach((snap, index) => {
          if (!snap.exists) return;
          tx.delete(edges[index]!);
          const followerUid = index === 0 ? me.uid : targetUid;
          const followingUid = index === 0 ? targetUid : me.uid;
          tx.update(users.doc(followerUid), { 'stats.followingCount': FieldValue.increment(-1) });
          tx.update(users.doc(followingUid), { 'stats.followerCount': FieldValue.increment(-1) });
        });
      });
    }
  },
);

export const unblockUser = onCall<BlockInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<BlockInput>): Promise<{ ok: true }> => {
    const me = await requireActiveUser(request);
    const targetUid = request.data?.uid;
    if (!isDocId(targetUid)) throw invalidArgument('Who do you want to unblock?');

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
