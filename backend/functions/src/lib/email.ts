/**
 * Sending email. One provider, one function, one place to change it.
 *
 * GMAIL, with an App Password, from loaneapp@gmail.com. Chosen because
 * it needs no domain records, no sales call and no sandbox approval —
 * an App Password and nothing else. It is the fastest way to have real
 * codes arriving in real inboxes today.
 *
 * ITS LIMITS, STATED PLAINLY, because this is a launch decision and
 * not a permanent one:
 *
 *   - A free Gmail account sends about 500 messages a day. One code
 *     per sign-up means that is a campus of 500 students a day, which
 *     is far past anything the first term needs — but it is a ceiling,
 *     and it is Google's to change.
 *   - A code from a personal gmail.com address is likelier to land in
 *     Spam or Promotions than one from joinloane.com. University mail
 *     filters are the fussiest audience there is, and this is the one
 *     email the whole sign-up depends on arriving.
 *
 * SWITCHING SENDER IS THIS FILE AND NOTHING ELSE. Everything above
 * sendVerificationEmail is provider detail; everything that calls it
 * passes a to, a code and a first name. To move to a domain sender
 * (Resend, SES, Postmark) replace `transport` and `FROM`, set the new
 * secret, and delete the Gmail ones. See README.
 *
 * WHAT THE EMAIL MUST NOT CONTAIN: a link. University mail systems run
 * scanners that follow every link in an incoming message, which burns
 * a one-time link before the student sees it. A code she types back
 * cannot be consumed by a robot reading her mail.
 */

import { createTransport, type Transporter } from 'nodemailer';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { brand, color } from '@loane/shared';
import { internal } from './errors';

/**
 * The Gmail App Password, as a Firebase secret.
 *
 * Set it with:
 *   firebase functions:secrets:set GMAIL_APP_PASSWORD --project loane-code
 *
 * It is NOT a password typed into a login box: an App Password lets
 * whoever holds it send as this account and read its inbox over IMAP,
 * and it bypasses 2-Step Verification. It therefore lives in Secret
 * Manager and nowhere else — never in the repo, never in a log line,
 * never in a chat message. If one is ever exposed, revoke it at
 * myaccount.google.com/apppasswords and set a new one; the old one
 * dies the moment it is deleted.
 */
export const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');

/** The account the App Password belongs to. Not a secret. */
const GMAIL_USER = 'loaneapp@gmail.com';

/**
 * The From line.
 *
 * Gmail will not let us forge the address — it sends as GMAIL_USER
 * whatever we write here — but it does honour the display name, so
 * the message arrives from "Loane" rather than from a string of
 * letters.
 */
const FROM = `${brand.name} <${GMAIL_USER}>`;

/** How long a code is good for. Quoted in the email; owned by the caller. */
export const CODE_TTL_MINUTES = 10;

let transport: Transporter | null = null;

function mailer(password: string): Transporter {
  // Reused across invocations of a warm instance: building a transport
  // per email means a fresh TLS handshake to Gmail every time.
  if (!transport) {
    transport = createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: password },
    });
  }
  return transport;
}

interface VerificationEmail {
  to: string;
  code: string;
  firstName: string;
}

/**
 * The plain-text half.
 *
 * Not a fallback nobody reads: some university clients render text
 * only, and a message with no text part scores worse with spam
 * filters than one with both.
 */
function plainText({ code, firstName }: Omit<VerificationEmail, 'to'>): string {
  return [
    `Hi ${firstName},`,
    '',
    `Your ${brand.name} code is ${code}`,
    '',
    `It expires in ${CODE_TTL_MINUTES} minutes.`,
    '',
    "If you didn't ask for this, you can ignore this email.",
    '',
    `${brand.name} — ${brand.taglines.primary}`,
  ].join('\n');
}

/**
 * The designed half.
 *
 * Tables and inline styles, which is not how anyone writes HTML in
 * 2026 but is still how email clients read it — Outlook ignores
 * stylesheets and flexbox outright. Deliberately plain: a code email
 * that looks like marketing gets filtered like marketing, and a
 * university spam filter is the one audience this has to get past.
 */
function html({ code, firstName }: Omit<VerificationEmail, 'to'>): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${color.brand.cream};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:${color.brand.cream};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:420px;background:#FFFFFF;border-radius:4px;padding:36px 32px;">
            <tr>
              <td align="center"
                  style="font-family:Georgia,'Times New Roman',serif;font-size:22px;
                         letter-spacing:6px;color:${color.brand.merlot};padding-bottom:28px;">
                ${brand.name.toUpperCase()}
              </td>
            </tr>
            <tr>
              <td style="font-family:Helvetica,Arial,sans-serif;font-size:16px;
                         line-height:24px;color:${color.text.primary};padding-bottom:24px;">
                Hi ${firstName},
              </td>
            </tr>
            <tr>
              <td align="center"
                  style="font-family:Helvetica,Arial,sans-serif;font-size:40px;
                         font-weight:bold;letter-spacing:10px;color:${color.brand.merlot};
                         padding:8px 0 8px 12px;">
                ${code}
              </td>
            </tr>
            <tr>
              <td align="center"
                  style="font-family:Helvetica,Arial,sans-serif;font-size:13px;
                         line-height:20px;color:${color.text.secondary};padding-top:20px;">
                This code expires in ${CODE_TTL_MINUTES} minutes.
              </td>
            </tr>
            <tr>
              <td align="center"
                  style="font-family:Helvetica,Arial,sans-serif;font-size:13px;
                         line-height:20px;color:${color.text.secondary};padding-top:8px;">
                If you didn't ask for this, you can ignore this email.
              </td>
            </tr>
          </table>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;
                      letter-spacing:1px;color:${color.text.muted};padding-top:20px;
                      text-transform:uppercase;">
            ${brand.taglines.primary}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail({
  to,
  code,
  firstName,
}: VerificationEmail): Promise<void> {
  const password = GMAIL_APP_PASSWORD.value();

  /*
    NO SECRET, NO SENDING — but not a dead end either.

    Against the emulator there is no Secret Manager, so the whole flow
    would be untestable if a missing password were fatal. Instead the
    code goes to the emulator console, which is the only place a
    developer can see it and nowhere a student ever looks.

    This is safe ONLY because it is impossible in production: a
    deployed function declares GMAIL_APP_PASSWORD in its `secrets`
    list and will not start without it. If that ever stops being true,
    this branch turns into "codes are printed in the logs", which is
    as bad as it sounds — so the guard is the deploy, not a flag.
  */
  if (!password) {
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      logger.warn(`[emulator] No GMAIL_APP_PASSWORD. Code for ${to}: ${code}`);
      return;
    }
    logger.error('GMAIL_APP_PASSWORD is not set. No verification email was sent.');
    throw internal('Email is not configured.');
  }

  try {
    await mailer(password).sendMail({
      from: FROM,
      to,
      // The code in the subject, so she can read it from the
      // notification without opening anything.
      subject: `Your ${brand.name} code is ${code}`,
      text: plainText({ code, firstName }),
      html: html({ code, firstName }),
    });
  } catch (error) {
    // The message can carry the recipient and, on an auth failure,
    // detail about the credential. Neither belongs in a log.
    logger.error('Gmail rejected the message', {
      name: (error as Error)?.name,
      // nodemailer puts Gmail's own code here; it is a status, not content.
      code: (error as { code?: string })?.code,
    });
    throw internal('Could not send that email.');
  }
}
