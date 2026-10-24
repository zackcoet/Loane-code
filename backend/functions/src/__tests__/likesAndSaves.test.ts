/**
 * Liking and saving looks, and saving pieces, against the emulator.
 *
 *   - Each moves its count once, however many times she taps.
 *   - A like tells the author; a save never does.
 *   - Nothing new lands on a look or piece that is gone (deleted, taken
 *     down, or not out yet) — but taking one back always works.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ELLA = 'uid-ella-likes'; // the author / owner
const HARPER = 'uid-harper-likes'; // tapping

type Fn = (req: CallableRequest<unknown>) => Promise<unknown>;
let app: App;
let db: Firestore;
let likePost: Fn;
let unlikePost: Fn;
let savePost: Fn;
let unsavePost: Fn;
let saveListing: Fn;
let unsaveListing: Fn;

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

function student(uid: string, username: string) {
  return {
    uid,
    username,
    displayName: username,
    photoUrl: null,
    campusId: 'university-of-south-carolina',
    isVerified: true,
    status: 'active',
  };
}

async function look(status = 'active') {
  await db.doc(`${COLLECTIONS.posts}/p1`).set({
    id: 'p1',
    authorUid: ELLA,
    campusId: 'university-of-south-carolina',
    status,
    stats: { likeCount: 0, saveCount: 0, commentCount: 0 },
  });
}

async function piece(status = 'active') {
  await db.doc(`${COLLECTIONS.listings}/l1`).set({
    id: 'l1',
    ownerUid: ELLA,
    campusId: 'university-of-south-carolina',
    status,
    stats: { saveCount: 0 },
  });
}

async function lookStats() {
  return (await db.doc(`${COLLECTIONS.posts}/p1`).get()).data()!.stats as {
    likeCount: number;
    saveCount: number;
  };
}

async function pieceSaves() {
  return (await db.doc(`${COLLECTIONS.listings}/l1`).get()).data()!.stats.saveCount as number;
}

async function ellaAlerts() {
  return (await db.collection(`${COLLECTIONS.users}/${ELLA}/notifications`).get()).size;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const posts = await import('../social/postEngagement');
  const saves = await import('../social/save');
  likePost = (r) => posts.likePost.run(r as never);
  unlikePost = (r) => posts.unlikePost.run(r as never);
  savePost = (r) => posts.savePost.run(r as never);
  unsavePost = (r) => posts.unsavePost.run(r as never);
  saveListing = (r) => saves.saveListing.run(r as never);
  unsaveListing = (r) => saves.unsaveListing.run(r as never);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.posts,
    COLLECTIONS.listings,
    COLLECTIONS.likes,
    COLLECTIONS.postSaves,
    COLLECTIONS.saves,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(student(ELLA, 'ellalikes'));
  await db.doc(`${COLLECTIONS.users}/${HARPER}`).set(student(HARPER, 'harperlikes'));
});

describe('liking a look', () => {
  it('counts once however many taps, and tells the author once', async () => {
    await look();
    expect(await attempt(() => likePost(as(HARPER, { postId: 'p1' })))).toBe('ok');
    expect(await attempt(() => likePost(as(HARPER, { postId: 'p1' })))).toBe('ok');
    expect((await lookStats()).likeCount).toBe(1);
    expect(await ellaAlerts()).toBe(1);
  });

  it('unlike gives the count back, once', async () => {
    await look();
    await likePost(as(HARPER, { postId: 'p1' }));
    await unlikePost(as(HARPER, { postId: 'p1' }));
    await unlikePost(as(HARPER, { postId: 'p1' }));
    expect((await lookStats()).likeCount).toBe(0);
  });

  for (const status of ['removed', 'suspended', 'scheduled']) {
    it(`no new like on a look that is ${status}, and no alert`, async () => {
      await look(status);
      expect(await attempt(() => likePost(as(HARPER, { postId: 'p1' })))).toMatch(/gone/);
      expect((await lookStats()).likeCount).toBe(0);
      expect(await ellaAlerts()).toBe(0);
    });
  }

  it('a like on a look that was later deleted can still be taken back', async () => {
    await look();
    await likePost(as(HARPER, { postId: 'p1' }));
    await db.doc(`${COLLECTIONS.posts}/p1`).update({ status: 'removed' });
    expect(await attempt(() => unlikePost(as(HARPER, { postId: 'p1' })))).toBe('ok');
    expect((await lookStats()).likeCount).toBe(0);
  });
});

describe('saving a look', () => {
  it('counts once and never tells the author', async () => {
    await look();
    await savePost(as(HARPER, { postId: 'p1' }));
    await savePost(as(HARPER, { postId: 'p1' }));
    expect((await lookStats()).saveCount).toBe(1);
    expect(await ellaAlerts()).toBe(0);
  });

  it('not on a deleted look, but un-saving one still works', async () => {
    await look();
    await savePost(as(HARPER, { postId: 'p1' }));
    await db.doc(`${COLLECTIONS.posts}/p1`).update({ status: 'removed' });
    expect(await attempt(() => savePost(as(ELLA, { postId: 'p1' })))).toMatch(/gone/);
    expect(await attempt(() => unsavePost(as(HARPER, { postId: 'p1' })))).toBe('ok');
    expect((await lookStats()).saveCount).toBe(0);
  });
});

describe('saving a piece', () => {
  it('counts once however many taps; unsave gives it back', async () => {
    await piece();
    await saveListing(as(HARPER, { listingId: 'l1' }));
    await saveListing(as(HARPER, { listingId: 'l1' }));
    expect(await pieceSaves()).toBe(1);
    await unsaveListing(as(HARPER, { listingId: 'l1' }));
    expect(await pieceSaves()).toBe(0);
  });

  for (const status of ['removed', 'suspended', 'draft']) {
    it(`no new save on a piece that is ${status}`, async () => {
      await piece(status);
      expect(await attempt(() => saveListing(as(HARPER, { listingId: 'l1' })))).toMatch(
        /no longer listed/,
      );
      expect(await pieceSaves()).toBe(0);
    });
  }

  for (const status of ['paused', 'sold']) {
    it(`a ${status} piece can still be saved — it is real and may come back`, async () => {
      await piece(status);
      expect(await attempt(() => saveListing(as(HARPER, { listingId: 'l1' })))).toBe('ok');
      expect(await pieceSaves()).toBe(1);
    });
  }

  it('a save on a piece that was later deleted can still be taken back', async () => {
    await piece();
    await saveListing(as(HARPER, { listingId: 'l1' }));
    await db.doc(`${COLLECTIONS.listings}/l1`).update({ status: 'removed' });
    expect(await attempt(() => unsaveListing(as(HARPER, { listingId: 'l1' })))).toBe('ok');
    expect(await pieceSaves()).toBe(0);
  });
});
