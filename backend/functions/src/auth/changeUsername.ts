import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, normalizeUsername, validateUsername, type UsernameLock } from '@loane/shared';
import { db, now } from '../lib/admin';
import { alreadyTaken, invalidArgument, notFound } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import { rateLimit } from '../lib/rateLimit';

/**
 * `changeUsername`
 *
 * Releases her old handle and claims the new one inside one transaction, so
 * the two can never be half-done and two people can never hold the same
 * name.
 *
 * The app cannot write `users.username` or the `usernames` collection at
 * all — the security rules forbid both — so this is the only way a handle
 * changes.
 */

export const changeUsername = onCall<{ username: string }, Promise<{ username: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<{ username: string }>): Promise<{ username: string }> => {
    const user = await requireActiveUser(request);

    const check = validateUsername(request.data?.username ?? '');
    if (!check.ok) throw invalidArgument(check.error!);

    const next = normalizeUsername(request.data.username);
    if (next === user.username) return { username: user.username };
    await rateLimit(user.uid, 'usernameChange');

    const userRef = db().collection(COLLECTIONS.users).doc(user.uid);
    const nextRef = db().collection(COLLECTIONS.usernames).doc(next);

    const current = await db().runTransaction(async (tx) => {
      const [taken, userSnap] = await Promise.all([tx.get(nextRef), tx.get(userRef)]);
      if (!userSnap.exists) throw notFound('We could not find your account.');

      /*
        Her CURRENT name is read here, inside the transaction — not from
        the copy loaded before it. Two changes sent close together (a
        double tap, two phones) both start from the same old name; the
        second would then release a lock that is already gone and leave
        the first one's new name locked to her forever, so nobody could
        ever take it. Read here, the second one retries and sees the
        first one's result.
      */
      const heldName = (userSnap.data() as { username: string }).username;
      if (heldName === next) return heldName;
      if (taken.exists) throw alreadyTaken('That username is taken. Try another.');

      const currentRef = db().collection(COLLECTIONS.usernames).doc(heldName);
      const currentLock = await tx.get(currentRef);
      const lock: UsernameLock = { username: next, uid: user.uid, createdAt: now() as never };
      tx.set(nextRef, lock);
      // Only her own lock is ever released.
      if ((currentLock.data() as UsernameLock | undefined)?.uid === user.uid) {
        tx.delete(currentRef);
      }
      tx.update(userRef, { username: next, updatedAt: now() });
      return heldName;
    });

    // Her username is denormalized onto her listings, posts, comments
    // and chats. propagateProfileChanges rewrites all four when the
    // user document changes, so nothing here has to.
    logger.info('Username changed', { uid: user.uid, from: current, to: next });

    return { username: next };
  },
);
