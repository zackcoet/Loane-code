/**
 * Proving she controls her school inbox: a 6-digit code.
 *
 * A CODE, NEVER A LINK. University mail systems run security scanners
 * that follow every link in an incoming message, which burns a
 * one-time link before the student has even opened the email. A code
 * she types back cannot be consumed by a robot reading her mail.
 *
 * SHIPS BEHIND A FLAG, OFF BY DEFAULT. `config/verification.required`
 * decides whether an unverified student is blocked. Off until the
 * email key is set on a project, because a REQUIRED verification that
 * cannot send email is a locked front door — nobody signs up, and the
 * failure looks like the app being broken rather than a missing
 * secret. Turning it on is an admin action once email works.
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
import { COLLECTIONS, normalizeEmail } from '@loane/shared';
import { db, now, Timestamp } from '../lib/admin';
import { failed, invalidArgument, internal } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import { RESEND_API_KEY, sendVerificationEmail } from '../lib/email';

/** Short enough that a stale code is rare, long enough to go and look. */
const CODE_TTL_MINUTES = 10;

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

export const sendVerificationCode = onCall<void, Promise<{ sent: true; expiresInMinutes: number }>>(
  { region: 'us-central1', secrets: [RESEND_API_KEY] },
  async (request: CallableRequest) => {
    const user = await requireActiveUser(request);
    if (user.emailConfirmed) throw failed('Your email is already confirmed.');

    const settings = await db()
      .collection(COLLECTIONS.users)
      .doc(user.uid)
      .collection('private')
      .doc('settings')
      .get();
    const email = normalizeEmail((settings.get('campusEmail') as string) ?? '');
    if (!email) throw failed('No school email on your account.');

    const ref = pendingRef(user.uid);
    const existing = (await ref.get()).data() as Pending | undefined;

    // --- The hourly limit -------------------------------------------------
    const hourAgo = Date.now() - 3600_000;
    const inWindow = existing && existing.windowStartedAt.toMillis() > hourAgo;
    const sendsThisHour = inWindow ? existing.sendsThisHour : 0;

    if (sendsThisHour >= MAX_SENDS_PER_HOUR) {
      throw failed('Too many codes requested. Try again in an hour.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    await ref.set({
      codeHash: hash(code, user.uid),
      email,
      expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MINUTES * 60_000),
      attempts: 0,
      sentAt: now(),
      sendsThisHour: sendsThisHour + 1,
      windowStartedAt: inWindow ? existing!.windowStartedAt : now(),
    });

    try {
      await sendVerificationEmail({ to: email, code, firstName: user.firstName });
    } catch (error) {
      logger.error('Verification email failed to send', {
        uid: user.uid,
        error: (error as Error)?.message,
      });
      // The code is already stored. Say so plainly rather than leaving
      // her watching an inbox nothing is coming to.
      throw internal('We could not send that email. Try again in a moment.');
    }

    // NEVER the code. A log line with a code in it is a code anybody
    // with log access can use.
    logger.info('Verification code sent', { uid: user.uid });
    return { sent: true, expiresInMinutes: CODE_TTL_MINUTES };
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
      verificationMethod: 'email_code',
      verifiedAt: now(),
      updatedAt: now(),
    });

    // The code is spent. Nothing to keep.
    await ref.delete();

    logger.info('Email confirmed', { uid: user.uid });
    return { confirmed: true };
  },
);
