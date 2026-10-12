/**
 * The server-side half of "only ask when it matters".
 *
 * The app puts a sheet in front of Loane It and Put it on Loane (see
 * mobile useProfileGate). That sheet is for her. THIS is the rule.
 * Anything that reaches the function without going through the app —
 * an old build, a replayed call, somebody poking at the endpoint —
 * still cannot arrange to meet a stranger without a face and a number.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, type User } from '@loane/shared';

const PROJECT = 'demo-loane-handoff';

let app: App;
let db: Firestore;

/** The guard under test, loaded after the emulator env is set. */
let requireHandoffReady: (user: User, doing: string) => Promise<void>;

const UID = 'uid-ella';

function userWith(photoUrl: string | null): User {
  // Only the two fields the guard reads are meaningful here.
  return { uid: UID, photoUrl } as User;
}

async function setPhone(phone: string | null) {
  await db.collection(COLLECTIONS.users).doc(UID).collection('private').doc('settings').set({
    uid: UID,
    phone,
  });
}

/** Runs the guard and reports whether it threw, and with what message. */
async function attempt(user: User): Promise<{ ok: boolean; message: string }> {
  try {
    await requireHandoffReady(user, 'you rent');
    return { ok: true, message: '' };
  } catch (error) {
    return { ok: false, message: (error as { message?: string }).message ?? '' };
  }
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT }, 'handoff-tests');
  db = getFirestore(app);
  ({ requireHandoffReady } = await import('../lib/guards'));
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection(COLLECTIONS.users));
});

describe('requireHandoffReady', () => {
  it('lets through somebody with both a photo and a phone number', async () => {
    await setPhone('+18035550100');
    expect((await attempt(userWith('https://example.test/ella.jpg'))).ok).toBe(true);
  });

  it('refuses somebody with no profile photo', async () => {
    await setPhone('+18035550100');
    const result = await attempt(userWith(null));
    expect(result.ok).toBe(false);
    // The message has to say what to do, not just that she cannot.
    expect(result.message).toMatch(/photo/i);
  });

  it('refuses somebody with no phone number', async () => {
    await setPhone(null);
    const result = await attempt(userWith('https://example.test/ella.jpg'));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/phone/i);
  });

  it('refuses somebody with no private settings document at all', async () => {
    // A document that was never created reads the same as one with no
    // number in it. The guard must not mistake "missing" for "fine".
    const result = await attempt(userWith('https://example.test/ella.jpg'));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/phone/i);
  });

  it('refuses an empty-string phone number', async () => {
    // normalizePhone returns '' for unparseable input, and Edit Profile
    // stores null — but a '' that ever reached the document must not
    // count as a phone number.
    await setPhone('');
    const result = await attempt(userWith('https://example.test/ella.jpg'));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/phone/i);
  });

  it('names the action, so the message fits where it is shown', async () => {
    await setPhone(null);
    try {
      await requireHandoffReady(userWith('https://example.test/ella.jpg'), 'you accept a rental');
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as { message: string }).message).toContain('you accept a rental');
    }
  });
});
