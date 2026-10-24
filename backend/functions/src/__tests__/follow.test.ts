/**
 * Following and unfollowing, against the emulator.
 *
 *   - A follow moves both counts once, however many times she taps.
 *   - Unfollow gives both counts back, once.
 *   - Nobody follows herself, someone she has blocked (or who blocked
 *     her), or a deleted or suspended account.
 *   - Unfollowing a deleted account still works, so her list can be tidied.
 *   - The alert carries the follower's account id, so it survives a rename.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, ids } from '@loane/shared';

const PROJECT = 'demo-loane';
const ELLA = 'uid-ella-follow';
const HARPER = 'uid-harper-follow';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let follow: (req: CallableRequest<any>) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let unfollow: (req: CallableRequest<any>) => Promise<any>;

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

function student(uid: string, username: string, status = 'active') {
  return {
    uid,
    username,
    displayName: username,
    photoUrl: null,
    campusId: 'university-of-south-carolina',
    isVerified: true,
    status,
    stats: { followerCount: 0, followingCount: 0 },
  };
}

async function counts(uid: string) {
  const stats = (await db.doc(`${COLLECTIONS.users}/${uid}`).get()).data()!.stats;
  return { followers: stats.followerCount, following: stats.followingCount };
}

async function edgeExists() {
  return (await db.doc(`${COLLECTIONS.follows}/${ids.follow(HARPER, ELLA)}`).get()).exists;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../social/follow');
  follow = (req) => mod.follow.run(req);
  unfollow = (req) => mod.unfollow.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.users, COLLECTIONS.follows, COLLECTIONS.rateLimits]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(student(ELLA, 'ellafollow'));
  await db.doc(`${COLLECTIONS.users}/${HARPER}`).set(student(HARPER, 'harperfollow'));
});

describe('follow', () => {
  it('moves both counts once, however many times she taps', async () => {
    expect(await attempt(() => follow(as(HARPER, { uid: ELLA })))).toBe('ok');
    expect(await attempt(() => follow(as(HARPER, { uid: ELLA })))).toBe('ok');
    expect(await edgeExists()).toBe(true);
    expect(await counts(ELLA)).toEqual({ followers: 1, following: 0 });
    expect(await counts(HARPER)).toEqual({ followers: 0, following: 1 });
  });

  it('tells her who followed, with a link that survives a rename', async () => {
    await follow(as(HARPER, { uid: ELLA }));
    const alerts = await db.collection(`${COLLECTIONS.users}/${ELLA}/notifications`).get();
    expect(alerts.size).toBe(1);
    const alert = alerts.docs[0]!.data();
    expect(alert.type).toBe('new_follower');
    expect(alert.actorUid).toBe(HARPER);
    expect(alert.deepLink).toBe(`/u/harperfollow?uid=${HARPER}`);
  });

  it('nobody follows herself', async () => {
    expect(await attempt(() => follow(as(HARPER, { uid: HARPER })))).toMatch(/yourself/);
  });

  it('not across a block, either way round', async () => {
    await db.doc(`${COLLECTIONS.users}/${ELLA}/blocked/${HARPER}`).set({ uid: HARPER });
    expect(await attempt(() => follow(as(HARPER, { uid: ELLA })))).toMatch(/not available/);
    expect(await edgeExists()).toBe(false);
  });

  it('not a deleted account', async () => {
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).update({ status: 'deactivated' });
    expect(await attempt(() => follow(as(HARPER, { uid: ELLA })))).toMatch(/could not find/);
    expect(await edgeExists()).toBe(false);
    expect(await counts(ELLA)).toEqual({ followers: 0, following: 0 });
  });

  it('not a suspended account', async () => {
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).update({ status: 'suspended' });
    expect(await attempt(() => follow(as(HARPER, { uid: ELLA })))).toMatch(/could not find/);
    expect(await edgeExists()).toBe(false);
  });

  it('not an account that does not exist', async () => {
    expect(await attempt(() => follow(as(HARPER, { uid: 'uid-nobody' })))).toMatch(
      /could not find/,
    );
  });
});

describe('unfollow', () => {
  it('gives both counts back, once', async () => {
    await follow(as(HARPER, { uid: ELLA }));
    expect(await attempt(() => unfollow(as(HARPER, { uid: ELLA })))).toBe('ok');
    expect(await attempt(() => unfollow(as(HARPER, { uid: ELLA })))).toBe('ok');
    expect(await edgeExists()).toBe(false);
    expect(await counts(ELLA)).toEqual({ followers: 0, following: 0 });
    expect(await counts(HARPER)).toEqual({ followers: 0, following: 0 });
  });

  it('still works after the other account was deleted', async () => {
    await follow(as(HARPER, { uid: ELLA }));
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).update({ status: 'deactivated' });
    expect(await attempt(() => unfollow(as(HARPER, { uid: ELLA })))).toBe('ok');
    expect(await edgeExists()).toBe(false);
    expect(await counts(HARPER)).toEqual({ followers: 0, following: 0 });
  });
});
