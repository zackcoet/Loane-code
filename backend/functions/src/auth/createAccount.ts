import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import type { Campus, User, UsernameLock, UserPrivate } from '@loane/shared';
import {
  COLLECTIONS,
  matchesCampusDomain,
  newUserStripe,
  normalizeEmail,
  normalizeUsername,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@loane/shared';
import { auth, db, now, FieldValue } from '../lib/admin';
import { alreadyTaken, failed, internal, invalidArgument } from '../lib/errors';
import { latestLegalVersions } from '../legal/legal';

/**
 * `createAccount`
 *
 * Creates the whole account — login, profile and username — in one
 * server-side call, then hands back a one-time token the app uses to sign
 * in.
 *
 * WHY IT WORKS THIS WAY
 *
 * The obvious approach is: the app creates the login with Firebase Auth,
 * then calls us to make the profile. That leaves a gap. Between those two
 * steps a login exists with no Loane profile behind it, and anyone willing
 * to skip the second call could sit in that state permanently.
 *
 * Doing it all here closes the gap. We check the school domain BEFORE any
 * account exists, and if the profile write fails for any reason we delete
 * the login we just made, so a half-built account can never survive.
 *
 * This function is deliberately callable while signed out — it is the one
 * endpoint that has to be. Rate limiting and App Check are Phase 8.
 *
 * NOTE FOR DEPLOY: `createCustomToken` signs a token, which in production
 * needs the functions service account to hold the "Service Account Token
 * Creator" role. It is a one-time grant in the Google Cloud console and
 * costs nothing. The emulator does not need it. See docs/setup.md.
 */

interface CreateAccountInput {
  firstName: string;
  /** Her school email. This is the ONLY email we collect. */
  email: string;
  password: string;
  username: string;
}

interface CreateAccountResult {
  uid: string;
  username: string;
  campusId: string;
  /** Short-lived token; the app calls signInWithCustomToken with it. */
  token: string;
}

/** Shown when the school is not on the approved list. */
const NOT_YET_MESSAGE = "Loane isn't at your school yet.";

export const createAccount = onCall<CreateAccountInput, Promise<CreateAccountResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<CreateAccountInput>): Promise<CreateAccountResult> => {
    const {
      firstName: rawFirstName,
      email: rawEmail,
      password,
      username: rawUsername,
    } = request.data ?? {};

    // --- Validate everything before creating anything --------------------
    const nameCheck = validateDisplayName(rawFirstName ?? '');
    if (!nameCheck.ok) throw invalidArgument(nameCheck.error!);

    const emailCheck = validateEmail(rawEmail ?? '');
    if (!emailCheck.ok) throw invalidArgument(emailCheck.error!);

    const passwordCheck = validatePassword(password ?? '');
    if (!passwordCheck.ok) throw invalidArgument(passwordCheck.error!);

    const usernameCheck = validateUsername(rawUsername ?? '');
    if (!usernameCheck.ok) throw invalidArgument(usernameCheck.error!);

    const firstName = rawFirstName.trim();
    const email = normalizeEmail(rawEmail);
    const username = normalizeUsername(rawUsername);

    // --- Is this school on the approved list? ----------------------------
    // Checked here, before any account exists, so a rejected signup leaves
    // nothing behind at all.
    const campusSnap = await db()
      .collection(COLLECTIONS.campuses)
      .where('isLive', '==', true)
      .get();
    const campus = campusSnap.docs
      .map((d) => ({ ...(d.data() as Campus), id: d.id }))
      .find((c) => matchesCampusDomain(email, c.emailDomains));

    if (!campus) throw failed(NOT_YET_MESSAGE);

    // Cheap pre-check so we usually fail before creating a login. The
    // transaction below is what actually guarantees uniqueness.
    const takenSnap = await db().collection(COLLECTIONS.usernames).doc(username).get();
    if (takenSnap.exists) throw alreadyTaken('That username is taken. Try another.');

    // --- Create the login ------------------------------------------------
    const legalVersions = await latestLegalVersions();

    let uid: string;
    try {
      const record = await auth().createUser({ email, password, displayName: firstName });
      uid = record.uid;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/email-already-exists') {
        throw alreadyTaken('That email already has an account. Try signing in.');
      }
      if (code === 'auth/invalid-password') {
        throw invalidArgument('That password is too weak.');
      }
      logger.error('createUser failed', { code });
      throw internal();
    }

    // --- Write the profile, or undo the login ----------------------------
    try {
      const userRef = db().collection(COLLECTIONS.users).doc(uid);
      const usernameRef = db().collection(COLLECTIONS.usernames).doc(username);
      const privateRef = userRef.collection('private').doc('settings');

      await db().runTransaction(async (tx) => {
        const existingUsername = await tx.get(usernameRef);
        if (existingUsername.exists) {
          throw alreadyTaken('That username is taken. Try another.');
        }

        const lock: UsernameLock = { username, uid, createdAt: now() as never };
        tx.set(usernameRef, lock);

        const profile: Omit<
          User,
          'id' | 'createdAt' | 'updatedAt' | 'verifiedAt' | 'emailConfirmedAt'
        > = {
          uid,
          username,
          firstName,
          displayName: firstName,
          bio: '',
          photoUrl: null,
          campusId: campus.id,
          // Her domain is approved, so she may use the app.
          isVerified: true,
          verificationMethod: 'domain_claimed',
          // We have NOT proven she controls the inbox. See the User type.
          emailConfirmed: false,
          showSizes: false,
          sizes: { tops: null, bottoms: null, dresses: null, shoe: null },
          role: 'student',
          status: 'active',
          suspendedReason: null,
          suspendedUntil: null,
          isFoundingCloset: false,
          legalAccepted: {
            termsVersion: legalVersions.termsVersion,
            termsAcceptedAt: now() as never,
            privacyVersion: legalVersions.privacyVersion,
            privacyAcceptedAt: now() as never,
          },
          stats: {
            followerCount: 0,
            followingCount: 0,
            listingCount: 0,
            postCount: 0,
            rentalsAsLender: 0,
            rentalsAsRenter: 0,
            ratingAverage: null,
            ratingCount: 0,
            cancellations: 0,
          },
          lastActiveAt: null,
          pushTokens: [],
          stripe: newUserStripe(),
        };

        tx.set(userRef, {
          ...profile,
          id: uid,
          createdAt: now(),
          updatedAt: now(),
          verifiedAt: now(),
          emailConfirmedAt: null,
        });

        const settings: Omit<UserPrivate, 'updatedAt'> = {
          uid,
          accountEmail: email,
          // Not on the public profile — see UserPrivate.campusEmail.
          campusEmail: email,
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
    } catch (error) {
      // The login exists but the profile does not. Undo it, so we never
      // leave an account behind that can do nothing.
      await auth()
        .deleteUser(uid)
        .catch((cleanupError) => {
          logger.error('Could not roll back a half-created account', { uid, cleanupError });
        });
      throw error;
    }

    const token = await auth().createCustomToken(uid);

    logger.info('Account created', { uid, campusId: campus.id });

    return { uid, username, campusId: campus.id, token };
  },
);

/**
 * `checkCampusEmail`
 *
 * Lets the sign-up screen say "Loane isn't at your school yet" as she types,
 * before she fills in a password. Advisory only — `createAccount` checks
 * again for real.
 */
export const checkCampusEmail = onCall<
  { email: string },
  Promise<{ allowed: boolean; campusName?: string; reason?: string }>
>({ region: 'us-central1' }, async (request) => {
  const raw = request.data?.email ?? '';
  const check = validateEmail(raw);
  if (!check.ok) return { allowed: false, reason: check.error };

  const email = normalizeEmail(raw);
  const campusSnap = await db().collection(COLLECTIONS.campuses).where('isLive', '==', true).get();
  const campus = campusSnap.docs
    .map((d) => d.data() as Campus)
    .find((c) => matchesCampusDomain(email, c.emailDomains));

  return campus
    ? { allowed: true, campusName: campus.name }
    : { allowed: false, reason: NOT_YET_MESSAGE };
});
