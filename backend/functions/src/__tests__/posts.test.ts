/**
 * Posting and deleting a look, and the scheduled-look sweep, against the
 * emulator.
 *
 *   - Posting writes the look, ticks her post count and each tagged
 *     piece's tag count; a piece that isn't hers or isn't active can't
 *     be tagged; a photo that isn't her upload is refused.
 *   - Deleting gives the counts back exactly once, even on a double-tap,
 *     and works when a tagged piece no longer exists at all.
 *   - The sweep publishes due looks past the first 100 scheduled, and
 *     never brings back a look deleted or taken down mid-sweep.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const AUTHOR = 'uid-author-posts';
const OTHER = 'uid-other-posts';
const MINE = 'listing-posts-mine';
const THEIRS = 'listing-posts-theirs';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createPost: (req: CallableRequest<any>) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deletePost: (req: CallableRequest<any>) => Promise<any>;
let publishDuePosts: (nowMs?: number) => Promise<number>;

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

function student(uid: string) {
  return {
    uid,
    username: uid.replace(/[^a-z]/g, ''),
    displayName: uid,
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
    emailConfirmed: true,
    status: 'active',
    stats: { postCount: 0 },
  };
}

function listing(id: string, ownerUid: string, status = 'active') {
  return {
    id,
    ownerUid,
    campusId: CAMPUS,
    status,
    name: `Piece ${id}`,
    coverUrl: 'https://example.com/c.jpg',
    pricing: { threeDayCents: 2500 },
    salePriceCents: null,
    owner: { username: ownerUid },
    stats: { tagCount: 0 },
  };
}

function photo(tags: { listingId: string; x: number; y: number }[] = []) {
  const path = `users/${AUTHOR}/posts/draft-1/0.jpg`;
  return {
    path,
    url: `https://firebasestorage.googleapis.com/v0/b/${PROJECT}.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`,
    width: 1080,
    height: 1350,
    tags,
  };
}

async function postCount() {
  return (await db.doc(`${COLLECTIONS.users}/${AUTHOR}`).get()).data()?.stats?.postCount;
}
async function tagCount(id: string) {
  return (await db.doc(`${COLLECTIONS.listings}/${id}`).get()).data()?.stats?.tagCount;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const create = await import('../posts/createPost');
  const del = await import('../posts/deletePost');
  const schedule = await import('../posts/schedule');
  createPost = (req) => create.createPost.run(req);
  deletePost = (req) => del.deletePost.run(req);
  publishDuePosts = schedule.publishDuePosts;
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.listings,
    COLLECTIONS.posts,
    COLLECTIONS.rateLimits,
    COLLECTIONS.reports,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${AUTHOR}`).set(student(AUTHOR));
  await db.doc(`${COLLECTIONS.users}/${OTHER}`).set(student(OTHER));
  await db.doc(`${COLLECTIONS.listings}/${MINE}`).set(listing(MINE, AUTHOR));
  await db.doc(`${COLLECTIONS.listings}/${THEIRS}`).set(listing(THEIRS, OTHER));
});

describe('createPost', () => {
  it('posts a look and moves her post count and the tagged piece’s tag count', async () => {
    const { postId } = await createPost(
      as(AUTHOR, {
        photos: [photo([{ listingId: MINE, x: 0.5, y: 0.5 }])],
        caption: '  gameday fit  ',
        occasions: ['gameday', 'gameday'],
      }),
    );
    const post = (await db.doc(`${COLLECTIONS.posts}/${postId}`).get()).data()!;
    expect(post.status).toBe('active');
    expect(post.caption).toBe('gameday fit');
    expect(post.occasions).toEqual(['gameday']);
    expect(post.taggedListingIds).toEqual([MINE]);
    expect(await postCount()).toBe(1);
    expect(await tagCount(MINE)).toBe(1);
  });

  it("refuses someone else's piece, an inactive piece and a missing one", async () => {
    await db
      .doc(`${COLLECTIONS.listings}/listing-paused`)
      .set(listing('listing-paused', AUTHOR, 'paused'));
    expect(
      await attempt(() =>
        createPost(as(AUTHOR, { photos: [photo([{ listingId: THEIRS, x: 0, y: 0 }])] })),
      ),
    ).toMatch(/your own closet/);
    expect(
      await attempt(() =>
        createPost(as(AUTHOR, { photos: [photo([{ listingId: 'listing-paused', x: 0, y: 0 }])] })),
      ),
    ).toMatch(/isn't active/);
    expect(
      await attempt(() =>
        createPost(as(AUTHOR, { photos: [photo([{ listingId: 'nope', x: 0, y: 0 }])] })),
      ),
    ).toMatch(/no longer listed/);
    expect(await postCount()).toBe(0);
  });

  it('refuses a photo that is not her own upload, and junk, without using up her hourly posts', async () => {
    expect(
      await attempt(() =>
        createPost(as(AUTHOR, { photos: [{ ...photo(), url: 'https://evil.example/x.jpg' }] })),
      ),
    ).toMatch(/did not upload/);
    expect(await attempt(() => createPost(as(AUTHOR, 'junk')))).toMatch(/at least one photo/);
    expect((await db.collection(COLLECTIONS.rateLimits).get()).size).toBe(0);
    expect((await db.collection(COLLECTIONS.posts).get()).size).toBe(0);
  });
});

describe('deletePost', () => {
  async function postOne() {
    const { postId } = await createPost(
      as(AUTHOR, { photos: [photo([{ listingId: MINE, x: 0.5, y: 0.5 }])] }),
    );
    return postId as string;
  }

  it('hides the look and gives the counts back', async () => {
    const postId = await postOne();
    await deletePost(as(AUTHOR, { postId }));
    const post = (await db.doc(`${COLLECTIONS.posts}/${postId}`).get()).data()!;
    expect(post.status).toBe('removed');
    expect(await postCount()).toBe(0);
    expect(await tagCount(MINE)).toBe(0);
  });

  it('a double-tap gives the counts back only once', async () => {
    const postId = await postOne();
    await Promise.all([deletePost(as(AUTHOR, { postId })), deletePost(as(AUTHOR, { postId }))]);
    expect(await postCount()).toBe(0);
    expect(await tagCount(MINE)).toBe(0);
  });

  it('still works when a tagged piece no longer exists at all', async () => {
    const postId = await postOne();
    await db.doc(`${COLLECTIONS.listings}/${MINE}`).delete();
    await deletePost(as(AUTHOR, { postId }));
    expect((await db.doc(`${COLLECTIONS.posts}/${postId}`).get()).data()?.status).toBe('removed');
    expect((await db.doc(`${COLLECTIONS.listings}/${MINE}`).get()).exists).toBe(false);
    expect(await postCount()).toBe(0);
  });

  it("refuses someone else's look, a missing one and junk", async () => {
    const postId = await postOne();
    expect(await attempt(() => deletePost(as(OTHER, { postId })))).toMatch(/not your post/);
    expect(await attempt(() => deletePost(as(AUTHOR, { postId: 'nope' })))).toMatch(/gone/);
    expect(await attempt(() => deletePost(as(AUTHOR, { postId: 7 })))).toMatch(/Which post/);
    expect(await attempt(() => deletePost(as(AUTHOR, { postId: 'a/b' })))).toMatch(/Which post/);
    expect(await attempt(() => deletePost(as(AUTHOR, null)))).toMatch(/Which post/);
    expect(await postCount()).toBe(1);
  });
});

describe('publishDuePosts', () => {
  const HOUR = 60 * 60 * 1000;

  async function scheduled(id: string, atMs: number) {
    await db.doc(`${COLLECTIONS.posts}/${id}`).set({
      id,
      authorUid: AUTHOR,
      campusId: CAMPUS,
      status: 'scheduled',
      scheduledAt: Timestamp.fromMillis(atMs),
    });
  }
  async function status(id: string) {
    return (await db.doc(`${COLLECTIONS.posts}/${id}`).get()).data()?.status;
  }

  it('publishes due looks and leaves future ones scheduled', async () => {
    const t = Date.now();
    await scheduled('due', t - HOUR);
    await scheduled('later', t + HOUR);
    expect(await publishDuePosts(t)).toBe(1);
    expect(await status('due')).toBe('active');
    expect(await status('later')).toBe('scheduled');
  });

  it('finds a due look behind more than 100 future ones', async () => {
    const t = Date.now();
    const writer = db.bulkWriter();
    for (let i = 0; i < 120; i++) {
      // ids sort before "zz-due", so a single first page would miss it
      writer.set(db.doc(`${COLLECTIONS.posts}/a-future-${String(i).padStart(3, '0')}`), {
        authorUid: AUTHOR,
        status: 'scheduled',
        scheduledAt: Timestamp.fromMillis(t + 24 * HOUR),
      });
    }
    await writer.close();
    await scheduled('zz-due', t - HOUR);
    expect(await publishDuePosts(t)).toBe(1);
    expect(await status('zz-due')).toBe('active');
  });

  it('never brings back a look deleted or taken down after it was read', async () => {
    const t = Date.now();
    await scheduled('deleted', t - HOUR);
    // Same check the sweep makes: only publish if untouched since the read.
    const read = await db.doc(`${COLLECTIONS.posts}/deleted`).get();
    await db.doc(`${COLLECTIONS.posts}/deleted`).update({ status: 'removed' });
    const write = db
      .doc(`${COLLECTIONS.posts}/deleted`)
      .update({ status: 'active' }, { lastUpdateTime: read.updateTime! });
    await expect(write).rejects.toBeTruthy();
    expect(await status('deleted')).toBe('removed');
    // And a deleted look is never picked up by the sweep at all.
    expect(await publishDuePosts(t)).toBe(0);
  });
});
