/**
 * "Which of my contacts are on Loane?", against the emulator.
 *
 *   - A contact's number finds her, and says whether she's already followed.
 *   - Her own number, other campuses, deleted or suspended accounts, people
 *     she has blocked and people who have blocked HER never come back.
 *   - Junk that isn't a SHA-256 is ignored, and a call is capped at 500.
 *   - Calls are counted, so nobody can guess numbers all day.
 *   - Nothing about the request is written down.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, SUBCOLLECTIONS, ids } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ME = 'uid-me-contacts';
const ANNA = 'uid-anna-contacts';
const BETH = 'uid-beth-contacts';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let matchContacts: (req: CallableRequest<any>) => Promise<any>;
let clientHash: (e164: string) => string;
let storedHash: (e164: string) => string;

function as(uid: string, data: unknown): CallableRequest<unknown> {
  return { auth: { uid, token: {} }, data } as unknown as CallableRequest<unknown>;
}

async function attempt(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

function student(uid: string, username: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    username,
    displayName: username,
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
    status: 'active',
    stats: { followerCount: 0, followingCount: 0 },
    ...extra,
  };
}

/** Puts a student on Loane with this phone number, the way the trigger would. */
async function withNumber(uid: string, e164: string) {
  await db.doc(`${COLLECTIONS.phoneHashes}/${storedHash(e164)}`).set({ uid });
}

async function found(numbers: string[]): Promise<string[]> {
  const result = await matchContacts(as(ME, { hashes: numbers.map(clientHash) }));
  return (result.matches as { uid: string }[]).map((m) => m.uid);
}

const ANNA_PHONE = '+18035550101';
const BETH_PHONE = '+18035550102';
const MY_PHONE = '+18035550100';

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  // The pepper's fixed development value — see lib/phoneHash.ts.
  process.env.FUNCTIONS_EMULATOR = 'true';
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../social/matchContacts');
  matchContacts = (req) => mod.matchContacts.run(req);
  const hashing = await import('../lib/phoneHash');
  clientHash = hashing.clientPhoneHash;
  storedHash = hashing.storedPhoneHashFromE164;
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.follows,
    COLLECTIONS.phoneHashes,
    COLLECTIONS.rateLimits,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${ME}`).set(student(ME, 'mecontacts'));
  await db.doc(`${COLLECTIONS.users}/${ANNA}`).set(student(ANNA, 'annacontacts'));
  await db.doc(`${COLLECTIONS.users}/${BETH}`).set(student(BETH, 'bethcontacts'));
  await withNumber(ME, MY_PHONE);
  await withNumber(ANNA, ANNA_PHONE);
  await withNumber(BETH, BETH_PHONE);
});

describe('matchContacts', () => {
  it('finds the people whose numbers she has, and nobody else', async () => {
    expect(await found([ANNA_PHONE, '+18035559999'])).toEqual([ANNA]);
  });

  it('says who she already follows, and puts the rest first', async () => {
    await db
      .doc(`${COLLECTIONS.follows}/${ids.follow(ME, ANNA)}`)
      .set({ followerUid: ME, followingUid: ANNA });
    const result = await matchContacts(
      as(ME, { hashes: [ANNA_PHONE, BETH_PHONE].map(clientHash) }),
    );
    expect(
      result.matches.map((m: { uid: string; isFollowing: boolean }) => [m.uid, m.isFollowing]),
    ).toEqual([
      [BETH, false],
      [ANNA, true],
    ]);
  });

  it('never returns her own number', async () => {
    expect(await found([MY_PHONE])).toEqual([]);
  });

  it('leaves out other campuses, deleted and suspended accounts', async () => {
    await db.doc(`${COLLECTIONS.users}/${ANNA}`).update({ campusId: 'clemson-university' });
    await db.doc(`${COLLECTIONS.users}/${BETH}`).update({ status: 'suspended' });
    expect(await found([ANNA_PHONE, BETH_PHONE])).toEqual([]);

    await db.doc(`${COLLECTIONS.users}/${ANNA}`).delete();
    expect(await found([ANNA_PHONE])).toEqual([]);
  });

  it('leaves out someone she has blocked', async () => {
    await db.doc(`${COLLECTIONS.users}/${ME}/${SUBCOLLECTIONS.userBlocked}/${ANNA}`).set({});
    expect(await found([ANNA_PHONE, BETH_PHONE])).toEqual([BETH]);
  });

  it('leaves out someone who has blocked HER', async () => {
    await db.doc(`${COLLECTIONS.users}/${ANNA}/${SUBCOLLECTIONS.userBlocked}/${ME}`).set({});
    expect(await found([ANNA_PHONE, BETH_PHONE])).toEqual([BETH]);
  });

  it('ignores anything that is not a SHA-256, and refuses more than 500 at once', async () => {
    const result = await matchContacts(
      as(ME, { hashes: [ANNA_PHONE, 'nope', 42, clientHash(ANNA_PHONE).toUpperCase()] }),
    );
    expect(result.matches).toEqual([]);

    const tooMany = Array.from({ length: 501 }, (_, i) => clientHash(`+1803555${1000 + i}`));
    expect(await attempt(() => matchContacts(as(ME, { hashes: tooMany })))).toMatch(/at most 500/);
  });

  it('counts calls, so nobody can guess numbers all day', async () => {
    for (let i = 0; i < 40; i++) {
      expect(await attempt(() => found(['+18035559999']))).toBe('ok');
    }
    expect(await attempt(() => found([ANNA_PHONE]))).toMatch(/checked your contacts/);
  });

  it('writes nothing about her address book', async () => {
    await found([ANNA_PHONE, BETH_PHONE, '+18035559999']);
    // Only the three numbers that were already on Loane.
    expect((await db.collection(COLLECTIONS.phoneHashes).get()).size).toBe(3);
    // And the only other trace is the call counter, which holds no numbers.
    const counters = await db.collection(COLLECTIONS.rateLimits).get();
    expect(counters.docs.map((d) => d.id)).toEqual([`contactMatch__${ME}`]);
    expect(Object.keys(counters.docs[0]!.data()).sort()).toEqual(['count', 'windowStartedAt']);
  });
});
