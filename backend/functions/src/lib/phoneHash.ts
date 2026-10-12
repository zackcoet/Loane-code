/**
 * Turning a phone number into something we can match on without
 * keeping anybody's phone number.
 *
 * WHAT THIS PROTECTS, AND WHAT IT DOES NOT. Be precise about this,
 * because "it's hashed" is the most overclaimed sentence in software.
 *
 * A US phone number is ten digits. That is ten billion possibilities,
 * which a laptop can hash in minutes — so a plain SHA-256 of a phone
 * number is NOT anonymous. Anyone who takes the `phoneHashes`
 * collection could rebuild every number in it.
 *
 * So the stored value is not a plain hash. It is
 *
 *     HMAC-SHA256(key = CONTACT_MATCH_PEPPER, message = SHA256(e164))
 *
 * and the pepper is a server secret the app never sees. Without it the
 * collection cannot be reversed, even by somebody holding the whole
 * database. That is the actual guarantee.
 *
 * The honest limits, written down so nobody later believes otherwise:
 *
 *   - The APP sends SHA256(number), not the raw number. It never sends
 *     names, emails or anything else from the address book, and the
 *     hashes it sends are not written down anywhere — matchContacts
 *     compares them and drops them.
 *   - Whoever holds the pepper AND the collection can still test a
 *     guess ("is 803-555-0100 in here?"). That is us. It is the price
 *     of the feature existing at all, and it is why the pepper is a
 *     secret rather than a constant in this file.
 *   - Rotating the pepper invalidates every stored hash. They are
 *     rebuilt from each user's own number by the trigger, so a rotation
 *     means a backfill, not data loss.
 *
 * Her own number is hers to remove. Clearing it deletes the hash, and
 * from that moment nobody's contacts match her.
 */

import { createHash, createHmac } from 'node:crypto';
import { defineSecret } from 'firebase-functions/params';

/**
 * The pepper. Set with:
 *   firebase functions:secrets:set CONTACT_MATCH_PEPPER
 *
 * In the emulator it falls back to a fixed development value, because
 * there is no secret manager and matching has to work on a laptop. The
 * fallback is NOT a secret and must never be the production value.
 */
export const CONTACT_MATCH_PEPPER = defineSecret('CONTACT_MATCH_PEPPER');

const EMULATOR_PEPPER = 'loane-emulator-pepper-not-a-secret';

function pepper(): string {
  // `.value()` is empty at module load and under the emulator, which is
  // why this is a function call rather than a constant.
  const configured = CONTACT_MATCH_PEPPER.value();
  if (configured) return configured;
  if (process.env.FUNCTIONS_EMULATOR === 'true') return EMULATOR_PEPPER;
  throw new Error('CONTACT_MATCH_PEPPER is not set. Contact matching is disabled.');
}

/**
 * What the APP computes and sends: a plain SHA-256 of the E.164 number.
 *
 * Exported so the trigger hashes its own user's number exactly the same
 * way the app hashes a contact's. If these two ever disagreed, nobody
 * would match anybody and nothing would look broken.
 */
export function clientPhoneHash(e164: string): string {
  return createHash('sha256').update(e164).digest('hex');
}

/** What gets STORED: the peppered version, which is the doc id. */
export function storedPhoneHash(clientHash: string): string {
  return createHmac('sha256', pepper()).update(clientHash).digest('hex');
}

/** Straight from a number to the stored id, for the trigger. */
export function storedPhoneHashFromE164(e164: string): string {
  return storedPhoneHash(clientPhoneHash(e164));
}
