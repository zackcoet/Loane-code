import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { clientPhoneHash, storedPhoneHash, storedPhoneHashFromE164 } from '../lib/phoneHash';

/**
 * These run under the emulator pepper, which is a fixed development
 * value — see lib/phoneHash.ts. What is being tested is the SHAPE of
 * the scheme, not the strength of a secret the tests do not have.
 */
process.env.FUNCTIONS_EMULATOR = 'true';

const ELLA = '+18035550100';

describe('clientPhoneHash — what the app sends', () => {
  it('is a plain SHA-256 of the E.164 number, so the app can compute it too', () => {
    expect(clientPhoneHash(ELLA)).toBe(createHash('sha256').update(ELLA).digest('hex'));
  });

  it('is 64 hex characters, which is what matchContacts validates against', () => {
    expect(clientPhoneHash(ELLA)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable — the same number always gives the same hash', () => {
    expect(clientPhoneHash(ELLA)).toBe(clientPhoneHash(ELLA));
  });

  it('differs for different numbers', () => {
    expect(clientPhoneHash(ELLA)).not.toBe(clientPhoneHash('+18035550101'));
  });
});

describe('storedPhoneHash — what Firestore holds', () => {
  it('is NOT the hash the app sent', () => {
    // The whole point. If these were equal, anybody holding the
    // collection could enumerate all ten billion US numbers against it.
    const sent = clientPhoneHash(ELLA);
    expect(storedPhoneHash(sent)).not.toBe(sent);
  });

  it('is not a plain hash of the number either', () => {
    expect(storedPhoneHashFromE164(ELLA)).not.toBe(createHash('sha256').update(ELLA).digest('hex'));
  });

  it('is 64 hex characters, usable as a document id', () => {
    expect(storedPhoneHashFromE164(ELLA)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('agrees whichever way it is reached', () => {
    // The trigger goes number -> stored. matchContacts goes
    // app-hash -> stored. If these two ever disagreed, nobody would
    // match anybody and nothing would look broken.
    expect(storedPhoneHashFromE164(ELLA)).toBe(storedPhoneHash(clientPhoneHash(ELLA)));
  });

  it('differs for different numbers', () => {
    expect(storedPhoneHashFromE164(ELLA)).not.toBe(storedPhoneHashFromE164('+18035550101'));
  });
});
