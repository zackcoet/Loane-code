import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { COLLECTIONS, normalizeUsername, validateUsername, type UsernameLock } from '@loane/shared';
import { db, now } from '../lib/admin';
import { alreadyTaken, invalidArgument, notFound } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';

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
    const current = user.username;
    if (next === current) return { username: current };

    const userRef = db().collection(COLLECTIONS.users).doc(user.uid);
    const nextRef = db().collection(COLLECTIONS.usernames).doc(next);
    const currentRef = db().collection(COLLECTIONS.usernames).doc(current);

    await db().runTransaction(async (tx) => {
      const [taken, userSnap] = await Promise.all([tx.get(nextRef), tx.get(userRef)]);
      if (taken.exists) throw alreadyTaken('That username is taken. Try another.');
      if (!userSnap.exists) throw notFound('We could not find your account.');

      const lock: UsernameLock = { username: next, uid: user.uid, createdAt: now() as never };
      tx.set(nextRef, lock);
      tx.delete(currentRef);
      tx.update(userRef, { username: next, updatedAt: now() });
    });

    // TODO-PHASE2/3: her username is denormalized onto her listings and
    // posts. A background job should refresh those copies. Until listings
    // and posts are editable this is only cosmetic on already-seeded data.
    logger.info('Username changed', { uid: user.uid, from: current, to: next });

    return { username: next };
  },
);
