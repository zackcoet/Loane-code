/**
 * Sending email. One provider, one function, one place to change it.
 *
 * RESEND, recommended because it is the least to set up and the
 * cheapest at our size: 3,000 emails a month free, then $20/month for
 * 50,000. A verification code per sign-up means a campus of a thousand
 * students costs nothing. It needs a domain record and an API key, and
 * nothing else — no sales call, no sandbox approval, no separate
 * "transactional" product.
 *
 * The alternatives, and why not: SendGrid's free tier ended and its
 * onboarding now involves sales; AWS SES is cheaper per email and
 * needs a support ticket to leave the sandbox plus a domain setup we
 * would have to maintain; Firebase's own extension sends through a
 * provider you still have to supply, which is this problem again with
 * a layer on top.
 *
 * WHAT THE EMAIL MUST NOT CONTAIN: a link. University mail systems run
 * scanners that follow every link in an incoming message, which burns
 * a one-time link before the student sees it. A code she types back
 * cannot be consumed by a robot reading her mail.
 */

import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { brand } from '@loane/shared';
import { internal } from './errors';

/**
 * Set with:
 *   firebase functions:secrets:set RESEND_API_KEY --project loane-code
 *
 * Until it is set, nothing sends and verification stays off — see
 * config/verification.
 */
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

/**
 * The From address. Must be on a domain verified with Resend.
 *
 * `noreply@` deliberately: a student replying to a code email should
 * not vanish into a mailbox nobody reads. Help & Support is where we
 * ask her to write.
 */
const FROM = 'Loane <noreply@joinloane.com>';

interface VerificationEmail {
  to: string;
  code: string;
  firstName: string;
}

export async function sendVerificationEmail({
  to,
  code,
  firstName,
}: VerificationEmail): Promise<void> {
  const key = RESEND_API_KEY.value();
  if (!key) {
    logger.error('RESEND_API_KEY is not set. No verification email was sent.');
    throw internal('Email is not configured.');
  }

  /*
    Plain and short. A code email that looks like marketing gets
    filtered like marketing, and a university spam filter is the one
    audience this has to get past.
  */
  const text = [
    `Hi ${firstName},`,
    '',
    `Your ${brand.name} code is ${code}`,
    '',
    'It expires in 10 minutes. If you did not ask for it, you can ignore this email.',
    '',
    `${brand.name} — ${brand.taglines.primary}`,
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `${code} is your ${brand.name} code`,
      text,
    }),
  });

  if (!response.ok) {
    // The body can contain the recipient; the status cannot.
    logger.error('Resend rejected the email', { status: response.status });
    throw internal('Could not send that email.');
  }
}
