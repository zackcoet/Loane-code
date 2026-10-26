import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import type { Campus, User, UsernameLock, UserPrivate } from '@loane/shared';
import {
  newUserWalkthrough,
  COLLECTIONS,
  color,
  emailDomain,
  findCampusForEmail,
  newCampusId,
  schoolDomain,
  newUserStripe,
  normalizeEmail,
  normalizeUsername,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
  newUserTryOn,
} from '@loane/shared';
import { auth, db, now, FieldValue } from '../lib/admin';
import { callerIp, rateLimit } from '../lib/rateLimit';
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

const EDU_MESSAGE = 'Use your .edu school email.';

export const createAccount = onCall<CreateAccountInput, Promise<CreateAccountResult>>(
  { region: 'us-central1' },
  async (request: CallableRequest<CreateAccountInput>): Promise<CreateAccountResult> => {
    /*
      BY IP, because there is no uid yet — an account is what this
      function makes. The IP is the only thing we have before one
      exists, and it is imperfect: a whole dorm, or the campus wifi,
      shares one, which is why the limit is thirty an hour rather than
      one (see LIMITS.signUp).

      An unknown IP is not limited at all. Bucketing every unknown
      caller together would lock out the world the first time a proxy
      stopped forwarding the header.
    */
    const ip = callerIp(request.rawRequest);
    if (ip) await rateLimit(ip, 'signUp');

    // Anything that isn't text counts as empty, so junk gets the form's
    // own friendly answer instead of crashing on `.trim()`.
    const data = (request.data ?? {}) as Partial<Record<keyof CreateAccountInput, unknown>>;
    const text = (value: unknown): string => (typeof value === 'string' ? value : '');
    const rawFirstName = text(data.firstName);
    const rawEmail = text(data.email);
    const password = text(data.password);
    const rawUsername = text(data.username);

    // --- Validate everything before creating anything --------------------
    const nameCheck = validateDisplayName(rawFirstName);
    if (!nameCheck.ok) throw invalidArgument(nameCheck.error!);

    const emailCheck = validateEmail(rawEmail);
    if (!emailCheck.ok) throw invalidArgument(emailCheck.error!);

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) throw invalidArgument(passwordCheck.error!);

    const usernameCheck = validateUsername(rawUsername);
    if (!usernameCheck.ok) throw invalidArgument(usernameCheck.error!);

    const firstName = rawFirstName.trim();
    const email = normalizeEmail(rawEmail);
    const username = normalizeUsername(rawUsername);

    // --- Is this a school email? -----------------------------------------
    // Launch used to gate this through seeded campuses. For now Loane is
    // open to every .edu school, and we create a lightweight campus bucket
    // for any domain we have not seeded yet.
    if (!isEduEmail(email)) throw failed(EDU_MESSAGE);
    const campus = await campusForEmail(email);

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
      const campusRef = db().collection(COLLECTIONS.campuses).doc(campus.id);

      await db().runTransaction(async (tx) => {
        const existingUsername = await tx.get(usernameRef);
        const existingCampus = await tx.get(campusRef);
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
          profileChecklist: { dismissed: false, foundFriendsAt: null },
          tryOn: newUserTryOn(),
          walkthrough: newUserWalkthrough(),
          notificationPreferences: {
            pushEnabled: true,
            rentals: true,
            social: true,
            messages: true,
            marketing: false,
          },
        };
        tx.set(privateRef, { ...settings, updatedAt: now() });

        tx.set(
          campusRef,
          {
            ...(!existingCampus.exists
              ? {
                  ...campus,
                  createdAt: now(),
                }
              : {}),
            /*
              A NESTED object, never 'stats.userCount'. With set(..., merge)
              a dotted key is NOT a path: it wrote a separate field
              literally named "stats.userCount", so the real count never
              moved (and account deletion, which uses update, counted it
              down below zero). Nested objects merge field by field.
            */
            stats: {
              // A brand-new campus also needs its other counts at zero.
              ...(!existingCampus.exists ? campus.stats : {}),
              userCount: FieldValue.increment(1),
              verifiedUserCount: FieldValue.increment(1),
            },
            updatedAt: now(),
          },
          { merge: true },
        );
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
 * Lets the sign-up screen validate a school email before she fills in a
 * password. Advisory only — `createAccount` checks again for real.
 */
export const checkCampusEmail = onCall<
  { email: string },
  Promise<{ allowed: boolean; campusName?: string; reason?: string }>
>({ region: 'us-central1' }, async (request) => {
  const raw = typeof request.data?.email === 'string' ? request.data.email : '';
  const check = validateEmail(raw);
  if (!check.ok) return { allowed: false, reason: check.error };

  const email = normalizeEmail(raw);
  if (!isEduEmail(email)) return { allowed: false, reason: EDU_MESSAGE };

  const campus = await campusForEmail(email);
  return { allowed: true, campusName: campus.name };
});

function isEduEmail(email: string): boolean {
  return emailDomain(email)?.endsWith('.edu') ?? false;
}

async function campusForEmail(email: string): Promise<Campus> {
  const domain = emailDomain(email);
  if (!domain) throw invalidArgument('Enter a valid email address.');

  const campusSnap = await db().collection(COLLECTIONS.campuses).where('isLive', '==', true).get();
  // Exact domain first, then a sub-address of a school's domain
  // (`g.clemson.edu` joins Clemson) — see shared/src/campusMatch.ts.
  const existing = findCampusForEmail(
    email,
    campusSnap.docs.map((d) => ({ ...(d.data() as Campus), id: d.id })),
  );
  if (existing) return existing;

  // The first girl from her school. The campus is named after the
  // school's own domain, never her sub-address, so the next girl —
  // whichever address she has — lands in the same place.
  const base = schoolDomain(domain);
  const id = newCampusId(domain);
  return {
    id,
    name: base,
    shortName: base,
    emailDomains: [base],
    city: '',
    state: '',
    brandColor: color.campus.dotFallback,
    isLive: true,
    stats: {
      userCount: 0,
      verifiedUserCount: 0,
      listingCount: 0,
      postCount: 0,
      bookingCount: 0,
    },
    createdAt: now() as never,
    updatedAt: now() as never,
  };
}
