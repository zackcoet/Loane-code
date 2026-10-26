/**
 * Signing up (`createAccount`), against the emulators.
 *
 *   - It makes the whole account in one go: login, profile, private
 *     settings, the username lock, and one more student on her campus.
 *   - A USC address joins USC; a school we have never seen gets its own
 *     campus, named after the school's domain — and a girl on a
 *     sub-address (`g.clemson.edu`) joins the same one.
 *   - Junk, a non-.edu email, a taken username or a used email are
 *     refused, and a refusal never leaves a half-made login behind.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const USC = 'university-of-south-carolina';
const PASSWORD = 'loane-test-1234';

// Fake, test-only addresses and handles. Every one is cleaned up below.
const EMAILS = [
  'signup-ella@email.sc.edu',
  'signup-kate@clemson-test.edu',
  'signup-mary@g.clemson-test.edu',
  'signup-anna@g.furman-test.edu',
  'signup-taken@email.sc.edu',
  'signup-junk@gmail.com',
];
const USERNAMES = ['signupella', 'signupkate', 'signupmary', 'signupanna', 'signuptaken'];
const NEW_CAMPUSES = [
  'school-clemson-test-edu',
  'school-furman-test-edu',
  'school-g-furman-test-edu',
];

let app: App;
let db: Firestore;
let auth: Auth;
let create: (req: CallableRequest<unknown>) => Promise<{ uid: string; campusId: string }>;

function signUp(data: Record<string, unknown>): CallableRequest<unknown> {
  // Signed out, from no known address (so the per-wifi limit is skipped).
  return { data, rawRequest: { headers: {} } } as unknown as CallableRequest<unknown>;
}

const form = (email: string, username: string) => ({
  firstName: 'Test',
  email,
  password: PASSWORD,
  username,
});

async function attempt(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

async function loginExists(email: string): Promise<boolean> {
  return auth
    .getUserByEmail(email)
    .then(() => true)
    .catch(() => false);
}

async function cleanUp() {
  for (const email of EMAILS) {
    const user = await auth.getUserByEmail(email).catch(() => null);
    if (user) {
      await auth.deleteUser(user.uid);
      await db.recursiveDelete(db.doc(`${COLLECTIONS.users}/${user.uid}`));
    }
  }
  for (const name of USERNAMES) await db.doc(`${COLLECTIONS.usernames}/${name}`).delete();
  for (const id of NEW_CAMPUSES) await db.doc(`${COLLECTIONS.campuses}/${id}`).delete();
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  process.env.GCLOUD_PROJECT = PROJECT;
  // The default app: the function's auth() and db() use it.
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  auth = getAuth(app);
  const mod = await import('../auth/createAccount');
  create = (req) => mod.createAccount.run(req as never) as never;
});

afterAll(async () => {
  await cleanUp();
  await deleteApp(app);
});

beforeEach(async () => {
  await cleanUp();
  await db.doc(`${COLLECTIONS.campuses}/${USC}`).set({
    id: USC,
    name: 'University of South Carolina',
    emailDomains: ['sc.edu', 'email.sc.edu'],
    isLive: true,
    stats: { userCount: 0, verifiedUserCount: 0 },
  });
});

describe('createAccount', () => {
  it('makes the whole account in one go, on USC', async () => {
    const result = await create(signUp(form(' Signup-Ella@Email.SC.edu ', 'SignupElla')));
    expect(result.campusId).toBe(USC);

    const profile = (await db.doc(`${COLLECTIONS.users}/${result.uid}`).get()).data();
    expect(profile).toMatchObject({
      username: 'signupella',
      campusId: USC,
      role: 'student',
      status: 'active',
      verificationMethod: 'domain_claimed',
      emailConfirmed: false,
    });
    // Her email is private, never on the public profile.
    expect(JSON.stringify(profile)).not.toContain('signup-ella');
    const settings = (
      await db.doc(`${COLLECTIONS.users}/${result.uid}/private/settings`).get()
    ).data();
    expect(settings?.accountEmail).toBe('signup-ella@email.sc.edu');
    expect((await db.doc(`${COLLECTIONS.usernames}/signupella`).get()).data()?.uid).toBe(
      result.uid,
    );
    const campus = (await db.doc(`${COLLECTIONS.campuses}/${USC}`).get()).data();
    expect(campus?.stats.userCount).toBe(1);
    expect(campus?.name).toBe('University of South Carolina');
  });

  it('puts a new school, and its sub-addresses, on one campus named after the school', async () => {
    const first = await create(signUp(form('signup-mary@g.clemson-test.edu', 'signupmary')));
    expect(first.campusId).toBe('school-clemson-test-edu');
    const campus = (await db.doc(`${COLLECTIONS.campuses}/school-clemson-test-edu`).get()).data();
    expect(campus?.emailDomains).toEqual(['clemson-test.edu']);
    expect(campus?.name).toBe('clemson-test.edu');
    // A new campus starts with every count, not just the student count.
    expect(campus?.stats).toMatchObject({ userCount: 1, listingCount: 0, postCount: 0 });
    // The count lives in stats, never in a stray field named "stats.userCount".
    expect(Object.keys(campus ?? {})).not.toContain('stats.userCount');

    const second = await create(signUp(form('signup-kate@clemson-test.edu', 'signupkate')));
    expect(second.campusId).toBe('school-clemson-test-edu');
    const after = (await db.doc(`${COLLECTIONS.campuses}/school-clemson-test-edu`).get()).data();
    expect(after?.stats.userCount).toBe(2);
  });

  it('leaves a school made the old way (on a sub-address) where it is', async () => {
    await db.doc(`${COLLECTIONS.campuses}/school-g-furman-test-edu`).set({
      id: 'school-g-furman-test-edu',
      name: 'g.furman-test.edu',
      emailDomains: ['g.furman-test.edu'],
      isLive: true,
      stats: { userCount: 3, verifiedUserCount: 3 },
    });
    const result = await create(signUp(form('signup-anna@g.furman-test.edu', 'signupanna')));
    expect(result.campusId).toBe('school-g-furman-test-edu');
  });

  it('refuses a non-school email and junk, before any login exists', async () => {
    expect(await attempt(() => create(signUp(form('signup-junk@gmail.com', 'signupjunk'))))).toBe(
      'Use your .edu school email.',
    );
    expect(await loginExists('signup-junk@gmail.com')).toBe(false);
    for (const bad of [
      { ...form('signup-ella@email.sc.edu', 'signupella'), password: 'short' },
      { ...form('signup-ella@email.sc.edu', 'signupella'), firstName: '' },
      { ...form('signup-ella@email.sc.edu', 'x') },
      { ...form('signup-ella@email.sc.edu', 'signupella'), firstName: 5, username: ['a'] },
      {},
    ]) {
      const answer = await attempt(() => create(signUp(bad)));
      expect(answer).not.toBe('ok');
      // A clear answer from the form's own checks, never a crash.
      expect(answer).not.toMatch(/went wrong/i);
    }
    expect(await loginExists('signup-ella@email.sc.edu')).toBe(false);
  });

  it('refuses a taken username or a used email, leaving nothing half-made', async () => {
    await create(signUp(form('signup-ella@email.sc.edu', 'signupella')));

    expect(
      await attempt(() => create(signUp(form('signup-taken@email.sc.edu', 'signupella')))),
    ).toMatch(/username is taken/);
    expect(await loginExists('signup-taken@email.sc.edu')).toBe(false);

    expect(
      await attempt(() => create(signUp(form('signup-ella@email.sc.edu', 'signuptaken')))),
    ).toMatch(/already has an account/);
    expect((await db.doc(`${COLLECTIONS.usernames}/signuptaken`).get()).exists).toBe(false);
    expect((await db.doc(`${COLLECTIONS.campuses}/${USC}`).get()).data()?.stats.userCount).toBe(1);
  });
});
