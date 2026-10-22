/**
 * Admin controls for try-on: the on/off switch, and granting a student
 * extra free try-ons.
 *
 * The grant exists for a concrete reason: the free allowance is five
 * for life, and Ella and our testers will burn through that in an
 * afternoon of looking at the thing they are meant to be judging.
 * Without this, the people whose opinion we need are the first people
 * locked out.
 *
 * Both are audited. A quota is money, and anything that moves money
 * leaves a row saying who did it and why.
 */

import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  SUBCOLLECTIONS,
  TRYON_FREE_LIFETIME,
  type User,
  type UserPrivate,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { invalidArgument, notFound } from '../lib/errors';
import { logAdminAction, requireAdminContext, requireReason } from '../admin/audit';
import { writeFeatureFlags } from '../lib/featureFlags';

/** One grant cannot be enormous. A typo should cost a conversation, not a bill. */
const MAX_GRANT = 100;

interface GrantInput {
  uid: string;
  count: number;
  reason: string;
}

export const grantTryOns = onCall<GrantInput, Promise<{ total: number }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { uid, count, reason: rawReason } = request.data ?? {};

    if (!uid) throw invalidArgument('Which student?');
    if (!Number.isInteger(count) || count < 1 || count > MAX_GRANT) {
      throw invalidArgument(`Give between 1 and ${MAX_GRANT} try-ons.`);
    }
    const reason = requireReason(rawReason, 'Why are you granting these?');

    const userRef = db().collection(COLLECTIONS.users).doc(uid);
    const privateRef = userRef.collection(SUBCOLLECTIONS.userPrivate).doc('settings');

    const total = await db().runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw notFound('No student with that id.');
      const user = userSnap.data() as User;

      const privateSnap = await tx.get(privateRef);
      const settings = privateSnap.data() as UserPrivate | undefined;

      // Read-then-write inside the transaction: two admins granting at
      // the same moment must not lose one of the grants.
      const bonus = (settings?.tryOn?.bonusGranted ?? 0) + count;

      tx.set(
        privateRef,
        { tryOn: { ...(settings?.tryOn ?? {}), bonusGranted: bonus }, updatedAt: now() },
        { merge: true },
      );

      logAdminAction(tx, {
        admin,
        action: 'tryon_granted',
        targetType: 'user',
        targetId: uid,
        notes: reason,
        before: { bonusGranted: settings?.tryOn?.bonusGranted ?? 0 },
        after: { bonusGranted: bonus, granted: count, username: user.username },
      });

      return TRYON_FREE_LIFETIME + bonus;
    });

    logger.info('Try-ons granted', { by: admin.uid, to: uid, count });
    return { total };
  },
);

interface ConfigInput {
  enabled?: boolean;
  enabledForAdmins?: boolean;
  reason: string;
}

/**
 * The older try-on switch. Kept because it is already deployed; it now
 * writes the same switchboard (`config/features`) as `setFeatureFlag`,
 * with the same audit row.
 */
export const setTryOnConfig = onCall<ConfigInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { enabled, enabledForAdmins, reason: rawReason } = request.data ?? {};
    const reason = requireReason(rawReason, 'Why are you changing this?');

    if (enabled === undefined && enabledForAdmins === undefined) {
      throw invalidArgument('Nothing to change.');
    }

    // Only the flags actually being changed. Firestore rejects an
    // undefined value outright.
    await writeFeatureFlags(
      admin,
      {
        ...(enabled === undefined ? {} : { tryOn: enabled }),
        ...(enabledForAdmins === undefined ? {} : { tryOnAdminPreview: enabledForAdmins }),
      },
      reason,
    );
    logger.warn('Try-on config changed', { by: admin.uid, enabled, enabledForAdmins });
    return { ok: true };
  },
);
