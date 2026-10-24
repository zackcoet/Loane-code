/**
 * Changing her @username, against the emulator.
 *
 *   - The new name is locked to her and the old one is freed.
 *   - A taken name is refused, and nothing moves.
 *   - Only her own lock is ever released — a stray lock under her old
 *     name that belongs to someone else stays.
 *   - Ten changes a day, then a friendly "try tomorrow".
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ELLA = 'uid-ella-rename';
const HARPER = 'uid-harper-rename';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rename: (req: CallableRequest<any>) => Promise<any>;

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

async function student(uid: string, username: string) {
  await db.doc(`${COLLECTIONS.users}/${uid}`).set({
    uid,
    username,
    displayName: username,
    campusId: 'university-of-south-carolina',
    isVerified: true,
    status: 'active',
  });
  await db.doc(`${COLLECTIONS.usernames}/${username}`).set({ username, uid });
}

async function lockOwner(name: string): Promise<string | null> {
  const snap = await db.doc(`${COLLECTIONS.usernames}/${name}`).get();
  return snap.exists ? (snap.data()!.uid as string) : null;
}

async function usernameOf(uid: string): Promise<string> {
  return (await db.doc(`${COLLECTIONS.users}/${uid}`).get()).data()!.username as string;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../auth/changeUsername');
  rename = (req) => mod.changeUsername.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.users, COLLECTIONS.usernames, COLLECTIONS.rateLimits]) {
    await db.recursiveDelete(db.collection(c));
  }
  await student(ELLA, 'ellarename');
  await student(HARPER, 'harperrename');
});

describe('changeUsername', () => {
  it('locks the new name to her and frees the old one', async () => {
    expect(await attempt(() => rename(as(ELLA, { username: 'ellanew' })))).toBe('ok');
    expect(await usernameOf(ELLA)).toBe('ellanew');
    expect(await lockOwner('ellanew')).toBe(ELLA);
    expect(await lockOwner('ellarename')).toBeNull();
  });

  it('a taken name is refused and nothing moves', async () => {
    expect(await attempt(() => rename(as(ELLA, { username: 'harperrename' })))).toMatch(/taken/);
    expect(await usernameOf(ELLA)).toBe('ellarename');
    expect(await lockOwner('ellarename')).toBe(ELLA);
    expect(await lockOwner('harperrename')).toBe(HARPER);
  });

  it('her old name can then be taken by someone else', async () => {
    await rename(as(ELLA, { username: 'ellanew' }));
    expect(await attempt(() => rename(as(HARPER, { username: 'ellarename' })))).toBe('ok');
    expect(await lockOwner('ellarename')).toBe(HARPER);
  });

  it('two changes in a row both land, and only the latest name stays locked', async () => {
    await rename(as(ELLA, { username: 'ellaone' }));
    await rename(as(ELLA, { username: 'ellatwo' }));
    expect(await usernameOf(ELLA)).toBe('ellatwo');
    expect(await lockOwner('ellatwo')).toBe(ELLA);
    // Before the fix, a change that started from a stale name left this
    // one locked to her forever.
    expect(await lockOwner('ellaone')).toBeNull();
    expect(await lockOwner('ellarename')).toBeNull();
  });

  it('never releases a lock that is not hers', async () => {
    await db
      .doc(`${COLLECTIONS.usernames}/ellarename`)
      .set({ username: 'ellarename', uid: HARPER });
    await rename(as(ELLA, { username: 'ellanew' }));
    expect(await lockOwner('ellarename')).toBe(HARPER);
  });

  it('asking for the name she already has changes nothing', async () => {
    expect(await attempt(() => rename(as(ELLA, { username: 'ellarename' })))).toBe('ok');
    expect(await lockOwner('ellarename')).toBe(ELLA);
  });

  it('ten changes a day, then try tomorrow', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect(await attempt(() => rename(as(ELLA, { username: `ella${i}x` })))).toBe('ok');
    }
    expect(await attempt(() => rename(as(ELLA, { username: 'ellaeleven' })))).toMatch(
      /Try again tomorrow/,
    );
    expect(await usernameOf(ELLA)).toBe('ella9x');
  });
});
