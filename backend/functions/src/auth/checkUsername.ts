import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTIONS, normalizeUsername, validateUsername } from '@loane/shared';
import { db } from '../lib/admin';

/**
 * `checkUsername`
 *
 * Lets the Claim Username screen say "that one's taken" before submitting.
 * Purely advisory — the real uniqueness check happens in the transaction in
 * `completeSignup`, because someone could claim the name in between.
 */

interface CheckUsernameInput {
  username: string;
}

interface CheckUsernameResult {
  available: boolean;
  /** Present when the username is not usable. Safe to show in the UI. */
  reason?: string;
}

export const checkUsername = onCall<CheckUsernameInput, Promise<CheckUsernameResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<CheckUsernameInput>): Promise<CheckUsernameResult> => {
    const raw = request.data?.username ?? '';
    const check = validateUsername(raw);
    if (!check.ok) return { available: false, reason: check.error };

    const username = normalizeUsername(raw);
    const snap = await db().collection(COLLECTIONS.usernames).doc(username).get();

    return snap.exists
      ? { available: false, reason: 'That username is taken. Try another.' }
      : { available: true };
  },
);
