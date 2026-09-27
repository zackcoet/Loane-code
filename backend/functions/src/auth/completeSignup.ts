import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import type { Campus, User, UsernameLock, UserPrivate } from '@loane/shared';
import {
  COLLECTIONS,
  matchesCampusDomain,
  normalizeEmail,
  normalizeUsername,
  validateDisplayName,
  validateEmail,
  validateUsername,
} from '@loane/shared';
import { db, now, FieldValue } from '../lib/admin';
import { alreadyTaken, failed, invalidArgument, requireAuthOrThrow } from './helpers';

/**
 * `completeSignup`
 *
 * Called once at the end of onboarding, after the Firebase Auth account
 * exists but before the user has a profile. It does three things that must
 * all succeed or all fail together:
 *
 *   1. Works out which campus the university email belongs to.
 *   2. Claims the username (by creating a lock document).
 *   3. Creates the user profile.
 *
 * Doing this in one transaction is what stops two people claiming the same
 * username at the same moment, and stops half-built accounts existing.
 *
 * ON VERIFICATION: we set `isVerified: true` as soon as the email domain
 * matches an approved campus. We do NOT send a confirmation email yet, so
 * this only proves she typed a campus address. `verificationMethod` records
 * 'domain_claimed' so that when real verification ships we know exactly
 * which accounts were never actually proven. See docs/security.md.
 */

interface CompleteSignupInput {
  firstName: string;
  campusEmail: string;
  username: string;
}

interface CompleteSignupResult {
  uid: string;
  username: string;
  campusId: string;
  isVerified: boolean;
}

export const completeSignup = onCall<CompleteSignupInput, Promise<CompleteSignupResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<CompleteSignupInput>): Promise<CompleteSignupResult> => {
    const uid = requireAuthOrThrow(request);
    const { firstName: rawFirstName, campusEmail: rawEmail, username: rawUsername } = request.data ?? {};

    // --- Validate everything before touching the database -----------------
    const nameCheck = validateDisplayName(rawFirstName ?? '');
    if (!nameCheck.ok) throw invalidArgument(nameCheck.error!);

    const emailCheck = validateEmail(rawEmail ?? '');
    if (!emailCheck.ok) throw invalidArgument(emailCheck.error!);

    const usernameCheck = validateUsername(rawUsername ?? '');
    if (!usernameCheck.ok) throw invalidArgument(usernameCheck.error!);

    const firstName = rawFirstName.trim();
    const campusEmail = normalizeEmail(rawEmail);
    const username = normalizeUsername(rawUsername);

    // --- Which campus does this email belong to? --------------------------
    const campusSnap = await db().collection(COLLECTIONS.campuses).where('isLive', '==', true).get();
    const campus = campusSnap.docs
      .map((d) => ({ ...(d.data() as Campus), id: d.id }))
      .find((c) => matchesCampusDomain(campusEmail, c.emailDomains));

    if (!campus) {
      throw failed(
        "We don't recognize that school email yet. Loane is starting at the University of South Carolina.",
      );
    }

    const userRef = db().collection(COLLECTIONS.users).doc(uid);
    const usernameRef = db().collection(COLLECTIONS.usernames).doc(username);
    const privateRef = userRef.collection('private').doc('settings');

    // --- One transaction: claim the name and create the profile ----------
    await db().runTransaction(async (tx) => {
      const [existingUser, existingUsername] = await Promise.all([
        tx.get(userRef),
        tx.get(usernameRef),
      ]);

      if (existingUser.exists) {
        throw failed('This account is already set up.');
      }
      if (existingUsername.exists) {
        throw alreadyTaken('That username is taken. Try another.');
      }

      const lock: UsernameLock = { username, uid, createdAt: now() as never };
      tx.set(usernameRef, lock);

      const profile: Omit<User, 'createdAt' | 'updatedAt' | 'verifiedAt' | 'id'> = {
        uid,
        username,
        firstName,
        displayName: firstName,
        bio: '',
        photoUrl: null,
        campusId: campus.id,
        campusEmail,
        // See the note above: domain match only, no confirmation email yet.
        isVerified: true,
        verificationMethod: 'domain_claimed',
        sizes: { general: null, shoe: null },
        role: 'student',
        status: 'active',
        suspendedReason: null,
        suspendedUntil: null,
        isFoundingCloset: false,
        stats: {
          followerCount: 0,
          followingCount: 0,
          listingCount: 0,
          postCount: 0,
          rentalsAsLender: 0,
          rentalsAsRenter: 0,
          ratingAverage: null,
          ratingCount: 0,
        },
        lastActiveAt: null,
        pushTokens: [],
        stripe: { accountId: null, customerId: null, payoutsEnabled: false },
      };

      tx.set(userRef, {
        ...profile,
        id: uid,
        createdAt: now(),
        updatedAt: now(),
        verifiedAt: now(),
      });

      const settings: Omit<UserPrivate, 'updatedAt'> = {
        uid,
        accountEmail: normalizeEmail(request.auth?.token?.email ?? campusEmail),
        phone: null,
        handoffNotes: null,
        notificationPreferences: {
          pushEnabled: true,
          rentals: true,
          social: true,
          messages: true,
          marketing: false,
        },
      };
      tx.set(privateRef, { ...settings, updatedAt: now() });

      tx.update(db().collection(COLLECTIONS.campuses).doc(campus.id), {
        'stats.userCount': FieldValue.increment(1),
        'stats.verifiedUserCount': FieldValue.increment(1),
        updatedAt: now(),
      });
    });

    logger.info('Signup completed', { uid, campusId: campus.id });

    return { uid, username, campusId: campus.id, isVerified: true };
  },
);
