/**
 * Proving she controls her school inbox: a 6-digit code.
 *
 * A CODE, NEVER A LINK. University mail systems run security scanners
 * that follow every link in an incoming message, which burns a
 * one-time link before the student has even opened the email. A code
 * she types back cannot be consumed by a robot reading her mail.
 *
 * THE CODE IS SENT BEFORE THE ACCOUNT EXISTS.
 *
 * She types her email on "Every great closet has a name behind it" and
 * taps Continue — that is when the email goes out. She then picks a
 * username and agrees to the terms, which takes most people a minute,
 * and by the time she reaches the last step the code is already
 * sitting in her inbox. Sending it at the end instead means she
 * finishes onboarding and then waits, staring at six empty boxes,
 * which is the worst possible moment to ask somebody to wait.
 *
 * SO CODES ARE KEYED BY EMAIL, NOT BY UID. There is no uid when the
 * first one is sent. The pending document lives at
 * `emailVerifications/{sha256(email)}`, which also means the
 * collection is not a list of real students' addresses.
 *
 * WHAT THIS COSTS, STATED PLAINLY: `startEmailVerification` can be
 * called by somebody who is not signed in, because nobody is signed in
 * at that point in sign-up. That is an endpoint which sends email to
 * an address of the caller's choosing, so it is held down from both
 * ends — by IP and by the address itself, five an hour each — and the
 * address must be a .edu, so it cannot be pointed at the world. It is
 * the same exposure `createAccount` already has, for the same
 * unavoidable reason.
 *
 * WHAT IS STORED: a hash of the code, never the code. A leaked
 * database should not let somebody verify as another student. Six
 * digits is only a million possibilities, so the attempt limit below
 * is what actually protects it — the hash protects the database, the
 * limit protects the account.
 *
 * ONLY ONCE, EVER. `emailConfirmed` is permanent. Nothing here runs
 * again for a student who has already confirmed, on any later sign-in
 * or any other device.
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
import { requireActiveUser } from '../lib/guards';
import { callerIp, rateLimit } from '../lib/rateLimit';
import { CODE_TTL_MINUTES, GMAIL_APP_PASSWORD, sendVerificationEmail } from '../lib/email';
import { campusForEmail, EDU_MESSAGE, isEduEmail } from './campus';

/** Codes per address per hour. Stops us being used to mail somebody. */
const MAX_SENDS_PER_HOUR = 5;

/**
 * Wrong guesses before the code dies.
 *
 * Six digits is a million possibilities; five guesses makes brute
 * force hopeless while leaving room for a genuine typo.
 */
const MAX_ATTEMPTS = 5;

/**
 * A code sent this recently is reused rather than replaced.
 *
 * The code screen asks for a code every time it opens, because it
 * cannot see whether one is already in flight — the pending documents
 * are closed to the app, deliberately. Without this, arriving from
 * sign-up (where one was just sent) would immediately burn a second
 * of her five, and the first email she opens would already be dead.
 *
 * Tapping Resend passes `force` and always gets a new one.
 */
const REUSE_WINDOW_MS = 2 * 60_000;

interface Pending {
  codeHash: string;
  email: string;
  expiresAt: FirebaseFirestore.Timestamp;
  attempts: number;
  sentAt: FirebaseFirestore.Timestamp;
  sendsThisHour: number;
  windowStartedAt: FirebaseFirestore.Timestamp;
}

/**
 * Salted with the address, so two students issued the same six digits
 * do not share a hash and one cannot be tested against the other.
 */
const hash = (code: string, email: string) =>
  createHash('sha256').update(`${email}:${code}`).digest('hex');

/** The document id. Hashed, so the collection is not a list of addresses. */
const keyFor = (email: string) => createHash('sha256').update(email).digest('hex');

function pendingRef(email: string) {
  return db().collection(COLLECTIONS.emailVerifications).doc(keyFor(email));
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
 * Shared by all three ways a code is issued — first send, resend, and
 * "that's not my address" — because they have to agree about the
 * hourly limit. If any of them issued a code by some other path, that
 * would be the way around the limit.
 */
async function issueCode(
  email: string,
  firstName: string,
  { force = false }: { force?: boolean } = {},
): Promise<{ sent: boolean; expiresInMinutes: number }> {
  if (!email) throw failed('No school email to send to.');

  const ref = pendingRef(email);
  const existing = (await ref.get()).data() as Pending | undefined;

  // A live code, sent moments ago. Leave it alone — see REUSE_WINDOW_MS.
  if (
    !force &&
    existing &&
    existing.expiresAt.toMillis() > Date.now() &&
    Date.now() - existing.sentAt.toMillis() < REUSE_WINDOW_MS
  ) {
    return { sent: false, expiresInMinutes: CODE_TTL_MINUTES };
  }

  // --- The hourly limit, per address --------------------------------------
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
    codeHash: hash(code, email),
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
    logger.error('Verification email failed to send', { error: (error as Error)?.message });
    // The code is already stored. Say so plainly rather than leaving
    // her watching an inbox nothing is coming to.
    throw internal('We could not send that email. Try again in a moment.');
  }

  // NEVER the code, and never the address. A log line with a code in
  // it is a code anybody with log access can use.
  logger.info('Verification code sent');
  return { sent: true, expiresInMinutes: CODE_TTL_MINUTES };
}

/**
 * `startEmailVerification` — from the email screen, before the account
 * exists.
 *
 * Deliberately callable while signed out. See the note at the top of
 * this file for what that costs and how it is held down.
 *
 * IT NEVER SAYS WHETHER AN ADDRESS IS ALREADY REGISTERED. "That email
 * is taken" here would turn this endpoint into a way of asking, for
 * any address, whether that person is on Loane — which for an app
 * whose users are all women at one university is not a small thing.
 * Sign-up itself refuses a duplicate a minute later, to somebody who
 * has already committed to making an account.
 */
export const startEmailVerification = onCall<
  { email?: string },
  Promise<{ sent: boolean; expiresInMinutes: number }>
>(
  { region: 'us-central1', secrets: [GMAIL_APP_PASSWORD] },
  async (request: CallableRequest<{ email?: string }>) => {
    // By IP, because there is no uid yet. Imperfect — a whole dorm
    // behind one NAT shares it — which is why it is five an hour and
    // not one.
    await rateLimit(callerIp(request.rawRequest), 'verificationEmail');

    const check = validateEmail(request.data?.email ?? '');
    if (!check.ok) throw invalidArgument(check.error ?? 'Enter a valid email address.');

    const email = normalizeEmail(request.data?.email ?? '');
    if (!isEduEmail(email)) throw invalidArgument(EDU_MESSAGE);

    // The name is only a greeting, and there is no account to read one from.
    return issueCode(email, 'there');
  },
);

/**
 * `sendVerificationCode` — "send it again", from the code screen.
 *
 * Signed in, because by this point the account exists.
 */
export const sendVerificationCode = onCall<
  { force?: boolean } | void,
  Promise<{ sent: boolean; expiresInMinutes: number }>
>(
  { region: 'us-central1', secrets: [GMAIL_APP_PASSWORD] },
  async (request: CallableRequest<{ force?: boolean } | void>) => {
    const user = await requireActiveUser(request);
    if (user.emailConfirmed) throw failed('Your email is already confirmed.');
    return issueCode(await campusEmailOf(user.uid), user.firstName, {
      // The screen opening is not a request for a new code; her
      // tapping Resend is.
      force: Boolean((request.data as { force?: boolean } | undefined)?.force),
    });
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
 */
export const changeUnverifiedEmail = onCall<
  { email?: string },
  Promise<{ sent: boolean; expiresInMinutes: number; email: string }>
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
      // Not worth a scary message: just send her another code.
      return { ...(await issueCode(email, user.firstName, { force: true })), email };
    }

    const campus = await campusForEmail(email);

    /*
      Taken by somebody else? Auth is the authority here, because the
      login is the thing that must be unique. Checking our own user
      documents instead would miss an account that exists in Auth but
      whose profile write failed.

      Safe to say so at this point, unlike in startEmailVerification:
      she has already proven she holds an account.
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

    return { ...(await issueCode(email, user.firstName, { force: true })), email };
  },
);

export const confirmVerificationCode = onCall<{ code?: string }, Promise<{ confirmed: true }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<{ code?: string }>) => {
    const user = await requireActiveUser(request);
    if (user.emailConfirmed) return { confirmed: true };

    const code = (request.data?.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw invalidArgument('Enter the 6-digit code.');

    /*
      Against HER OWN address, read from the server's copy of it.

      Not against an address passed in by the caller: that would let
      somebody with an account ask "is 123456 the code for this other
      student's email", one guess at a time, against every code in
      flight at once.
    */
    const email = await campusEmailOf(user.uid);
    const ref = pendingRef(email);
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

    if (pending.codeHash !== hash(code, email)) {
      await ref.update({ attempts: pending.attempts + 1 });
      const left = MAX_ATTEMPTS - pending.attempts - 1;
      throw failed(
        left > 0 ? `That code is not right. ${left} tries left.` : 'That code is not right.',
      );
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
