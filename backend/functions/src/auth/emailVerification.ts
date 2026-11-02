/**
 * Proving she controls her school inbox: a 6-digit code.
 *
 * A CODE, NEVER A LINK. University mail systems run security scanners
 * that follow every link in an incoming message, which burns a
 * one-time link before the student has even opened the email. A code
 * she types back cannot be consumed by a robot reading her mail.
 *
 * BEHIND A FLAG. `config/verification.required` decides whether an
 * unconfirmed student is blocked. It stays off on any project where
 * the email secret is not set, because a REQUIRED verification that
 * cannot send email is a locked front door — nobody gets in, and the
 * failure looks like the app being broken rather than a missing
 * secret. Turning it on is an admin action, once a test code has
 * actually arrived in a real inbox.
 *
 * WHAT IS STORED: a hash of the code, never the code. A leaked
 * database should not let somebody verify as another student. Six
 * digits is only a million possibilities, so the attempt limit below
 * is what actually protects it — the hash protects the database, the
 * limit protects the account.
 */

import { createHash, randomInt } from 'node:crypto';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  normalizeEmail,
  validateEmail,
  type VerificationMethod,
} from '@loane/shared';
import { auth, db, now, Timestamp } from '../lib/admin';
import { alreadyTaken, failed, invalidArgument, internal } from '../lib/errors';
import { campusForEmail, EDU_MESSAGE, isEduEmail } from './campus';
import { requireActiveUser } from '../lib/guards';
import { CODE_TTL_MINUTES, GMAIL_APP_PASSWORD, sendVerificationEmail } from '../lib/email';

/** Codes per hour. Stops us being used to send mail to somebody else. */
const MAX_SENDS_PER_HOUR = 5;

/**
 * Wrong guesses before the code dies.
 *
 * Six digits is a million possibilities; five guesses makes brute
 * force hopeless while leaving room for a genuine typo.
 */
const MAX_ATTEMPTS = 5;

interface Pending {
  codeHash: string;
  email: string;
  expiresAt: FirebaseFirestore.Timestamp;
  attempts: number;
  sentAt: FirebaseFirestore.Timestamp;
  sendsThisHour: number;
  windowStartedAt: FirebaseFirestore.Timestamp;
}

const hash = (code: string, uid: string) =>
  // Salted with her uid, so two students with the same code do not
  // share a hash and one cannot be tested against the other.
  createHash('sha256').update(`${uid}:${code}`).digest('hex');

function pendingRef(uid: string) {
  return db().collection(COLLECTIONS.users).doc(uid).collection('private').doc('verification');
}

/** Her school email, which lives on the private settings document. */
async function campusEmailOf(uid: string): Promise<string> {
  const settings = await db()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection('private')
    .doc('settings')
    .get();
  return normalizeEmail((settings.get('campusEmail') as string) ?? '');
}

/**
 * Mint a code, store its hash, send it.
 *
 * Shared by "send me a code" and "I typed my address wrong", because
 * those two must agree about the hourly limit. If changing the address
 * issued a code by some other path, that would be the way around the
 * limit — type a new address, get another five.
 *
 * `resetWindow` is for a genuinely new address: the hourly count
 * belongs to the person, not the mailbox, so it carries over. The one
 * case it does not is the very first code to a changed address, where
 * the previous document belonged to a different email entirely.
 */
async function issueCode(
  uid: string,
  email: string,
  firstName: string,
): Promise<{ sent: true; expiresInMinutes: number }> {
  if (!email) throw failed('No school email on your account.');

  const ref = pendingRef(uid);
  const existing = (await ref.get()).data() as Pending | undefined;

  // --- The hourly limit ---------------------------------------------------
  const hourAgo = Date.now() - 3600_000;
  const inWindow = existing && existing.windowStartedAt.toMillis() > hourAgo;
  const sendsThisHour = inWindow ? existing.sendsThisHour : 0;

  if (sendsThisHour >= MAX_SENDS_PER_HOUR) {
    throw failed('Too many codes requested. Try again in an hour.');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  /*
    `set` with no merge, which is what kills the previous code: the
    whole document is replaced, so the old hash and its attempt count
    are gone rather than lingering beside the new one. A new code
    cancelling the old one is a rule, and this is where it happens.
  */
  await ref.set({
    codeHash: hash(code, uid),
    email,
    expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MINUTES * 60_000),
    attempts: 0,
    sentAt: now(),
    sendsThisHour: sendsThisHour + 1,
    windowStartedAt: inWindow ? existing!.windowStartedAt : now(),
  });

  try {
    await sendVerificationEmail({ to: email, code, firstName });
  } catch (error) {
    logger.error('Verification email failed to send', {
      uid,
      error: (error as Error)?.message,
    });
    // The code is already stored. Say so plainly rather than leaving
    // her watching an inbox nothing is coming to.
    throw internal('We could not send that email. Try again in a moment.');
  }

  // NEVER the code. A log line with a code in it is a code anybody
  // with log access can use.
  logger.info('Verification code sent', { uid });
  return { sent: true, expiresInMinutes: CODE_TTL_MINUTES };
}

export const sendVerificationCode = onCall<void, Promise<{ sent: true; expiresInMinutes: number }>>(
  { region: 'us-central1', secrets: [GMAIL_APP_PASSWORD] },
  async (request: CallableRequest) => {
    const user = await requireActiveUser(request);
    if (user.emailConfirmed) throw failed('Your email is already confirmed.');
    return issueCode(user.uid, await campusEmailOf(user.uid), user.firstName);
  },
);

/**
 * `changeUnverifiedEmail` — "that's not my address".
 *
 * She mistypes her address, the code goes somewhere she cannot read,
 * and without this she is stuck on the code screen with a working
 * account she can never reach. Deleting the half-made account and
 * starting again would also work and is what a lot of apps do; it is
 * worse, because it throws away a username she has already chosen.
 *
 * ONLY WHILE UNCONFIRMED. Once an address is proven it is how she
 * signs in, and changing it becomes an account-recovery question with
 * a completely different threat model — somebody with five minutes at
 * her unlocked phone should not be able to move her account to their
 * own mailbox. That belongs in Settings, behind her password, and is
 * not this.
 *
 * The new address must still be a school one, and must not already
 * belong to somebody: both are the same checks sign-up makes.
 */
export const changeUnverifiedEmail = onCall<
  { email?: string },
  Promise<{ sent: true; expiresInMinutes: number; email: string }>
>(
  { region: 'us-central1', secrets: [GMAIL_APP_PASSWORD] },
  async (request: CallableRequest<{ email?: string }>) => {
    const user = await requireActiveUser(request);
    if (user.emailConfirmed) {
      throw failed('Your email is already confirmed. Change it in Settings.');
    }

    const check = validateEmail(request.data?.email ?? '');
    if (!check.ok) throw invalidArgument(check.error ?? 'Enter a valid email address.');

    const email = normalizeEmail(request.data?.email ?? '');
    if (!isEduEmail(email)) throw invalidArgument(EDU_MESSAGE);

    if (email === (await campusEmailOf(user.uid))) {
      // Not an error worth a scary message: just send her another code.
      return { ...(await issueCode(user.uid, email, user.firstName)), email };
    }

    const campus = await campusForEmail(email);

    /*
      Taken by somebody else? Auth is the authority here, because the
      login is the thing that must be unique. Checking our own user
      documents instead would miss an account that exists in Auth but
      whose profile write failed.
    */
    try {
      const existing = await auth().getUserByEmail(email);
      if (existing.uid !== user.uid) throw alreadyTaken('That email is already in use.');
    } catch (error) {
      // auth/user-not-found is the good case: nobody has it.
      const code = (error as { code?: string })?.code;
      if (code !== 'auth/user-not-found') throw error;
    }

    /*
      Auth first, then our own documents.

      If Auth succeeds and the rest fails she can still sign in with
      the new address, which is recoverable. The other order leaves
      our records pointing at an address she cannot sign in with,
      which is not.
    */
    await auth().updateUser(user.uid, { email });

    await db()
      .collection(COLLECTIONS.users)
      .doc(user.uid)
      .collection('private')
      .doc('settings')
      .set({ campusEmail: email, updatedAt: now() }, { merge: true });

    // Her campus comes from her domain, so a new domain can move her.
    await db().collection(COLLECTIONS.users).doc(user.uid).update({
      campusId: campus.id,
      campusName: campus.name,
      updatedAt: now(),
    });

    logger.info('Unverified email changed', { uid: user.uid, campusId: campus.id });

    return { ...(await issueCode(user.uid, email, user.firstName)), email };
  },
);

export const confirmVerificationCode = onCall<{ code?: string }, Promise<{ confirmed: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<{ code?: string }>) => {
    const user = await requireActiveUser(request);
    if (user.emailConfirmed) return { confirmed: true };

    const code = (request.data?.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw invalidArgument('Enter the 6-digit code.');

    const ref = pendingRef(user.uid);
    const pending = (await ref.get()).data() as Pending | undefined;
    if (!pending) throw failed('Ask for a new code.');

    if (pending.expiresAt.toMillis() < Date.now()) {
      await ref.delete();
      throw failed('That code has expired. Ask for a new one.');
    }

    if (pending.attempts >= MAX_ATTEMPTS) {
      await ref.delete();
      throw failed('Too many wrong tries. Ask for a new code.');
    }

    if (pending.codeHash !== hash(code, user.uid)) {
      await ref.update({ attempts: pending.attempts + 1 });
      const left = MAX_ATTEMPTS - pending.attempts - 1;
      throw failed(left > 0 ? `That code is not right. ${left} tries left.` : 'That code is not right.');
    }

    // Both flags, and both for a reason — see User.emailConfirmed.
    await db().collection(COLLECTIONS.users).doc(user.uid).update({
      emailConfirmed: true,
      emailConfirmedAt: now(),
      // 'email_confirmed', not 'email_code' — see VERIFICATION_METHODS.
      // The old spelling was not one of the three allowed values and
      // typecheck never caught it, because an update object is a bag
      // of fields rather than a User.
      verificationMethod: 'email_confirmed' satisfies VerificationMethod,
      verifiedAt: now(),
      updatedAt: now(),
    });

    // The code is spent. Nothing to keep.
    await ref.delete();

    logger.info('Email confirmed', { uid: user.uid });
    return { confirmed: true };
  },
);
