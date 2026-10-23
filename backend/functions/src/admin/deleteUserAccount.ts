import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type User } from '@loane/shared';
import { db } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { logAdminAction, requireAdminContext, requireReason } from './audit';
import { eraseAccount } from '../auth/deleteAccount';

/**
 * `adminDeleteAccount` — Dashboard → a student → Delete this account.
 *
 * For a privacy request from a student who cannot do it herself (she
 * lost her phone, or wrote to us instead of using the app). It runs the
 * exact same steps as her own "Delete my account" (`eraseAccount`), so
 * the two can never promise different things.
 *
 * Safeguards, because this cannot be undone:
 *   - Admins only, with a reason, and an audit row that commits in the
 *     same write that turns her into "Deleted account".
 *   - The admin must type her @username. A reason alone is too easy to
 *     fill in on the wrong student's page.
 *   - Never an admin account, never yourself — same as suspending.
 *   - Refuses while she has a rental going, like her own button.
 *   - Safe to run again if it stopped halfway.
 */

interface Input {
  uid: string;
  reason: string;
  /** Her @username, typed by the admin, without the @. */
  confirmUsername: string;
}

export const adminDeleteAccount = onCall<Input, Promise<{ ok: true }>>(
  { region: 'us-central1', timeoutSeconds: 300 },
  async (request) => {
    const admin = requireAdminContext(request);
    const { uid, reason: rawReason, confirmUsername } = request.data ?? ({} as Partial<Input>);
    if (!uid || typeof uid !== 'string') throw invalidArgument('Which student?');
    const reason = requireReason(rawReason, 'Why are you deleting her account?');
    if (uid === admin.uid) throw failed("You can't delete your own account from here.");

    const snap = await db().collection(COLLECTIONS.users).doc(uid).get();
    if (!snap.exists) throw notFound('No student with that id.');
    const user = snap.data() as User;

    if (user.role === 'admin') {
      throw failed('Admin accounts cannot be deleted from the dashboard.');
    }

    const typed = String(confirmUsername ?? '')
      .trim()
      .replace(/^@/, '')
      .toLowerCase();
    // A shell from a half-finished earlier attempt has a new username;
    // retrying it must still work, so a deactivated account skips this.
    if (user.status !== 'deactivated' && typed !== user.username.toLowerCase()) {
      throw invalidArgument(`Type @${user.username} to confirm.`);
    }

    await eraseAccount(uid, user, (batch) => {
      logAdminAction(batch, {
        admin,
        action: 'user_account_deleted',
        targetType: 'user',
        targetId: uid,
        notes: reason,
        before: { username: user.username, status: user.status },
        after: { status: 'deactivated' },
      });
    });

    logger.warn('Account deleted by admin', { uid, by: admin.uid });
    return { ok: true };
  },
);
