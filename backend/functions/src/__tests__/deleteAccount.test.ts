/**
 * "Delete my account" — the promises the Privacy Policy makes, checked.
 *
 *   - It refuses while a rental is still going.
 *   - It refuses without a fresh password sign-in.
 *   - Her own things go; other people's counts move back.
 *   - Shared records stay, without her name.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, DELETED_ACCOUNT_NAME, deletedUsername } from '@loane/shared';

const PROJECT = 'demo-loane';
const ELLA = 'uid-ella-delete';
const HARPER = 'uid-harper-delete';

let app: App;
let db: Firestore;
let run: (req: CallableRequest<void>) => Promise<{ ok: true }>;

function request(uid: string, authAgeSeconds = 10): CallableRequest<void> {
  return {
    auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) - authAgeSeconds } },
    data: undefined,
  } as unknown as CallableRequest<void>;
}

async function attempt(req: CallableRequest<void>): Promise<string> {
  try {
    await run(req);
    return 'ok';
  } catch (error) {
    return (error as { message?: string }).message ?? 'error';
  }
}

function user(uid: string, username: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    username,
    firstName: username,
    displayName: username,
    bio: 'hi',
    photoUrl: 'https://example.test/me.jpg',
    campusId: 'university-of-south-carolina',
    isVerified: true,
    role: 'student',
    status: 'active',
    sizes: { tops: 'S', bottoms: 'S', dresses: 'S', shoe: '8' },
    stats: { followerCount: 1, followingCount: 1, listingCount: 1, postCount: 1 },
    ...extra,
  };
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199';
  process.env.GCLOUD_PROJECT = PROJECT;
  // The DEFAULT app, not a named one: the function's Storage calls use
  // the default app, exactly as they do in production.
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../auth/deleteAccount');
  run = (req) => mod.deleteMyAccount.run(req);
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
    COLLECTIONS.follows,
    COLLECTIONS.bookings,
    COLLECTIONS.reviews,
    COLLECTIONS.comments,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await getAuth(app)
    .deleteUser(ELLA)
    .catch(() => undefined);
  await getAuth(app).createUser({ uid: ELLA, email: 'ella-delete@email.sc.edu' });

  await db.doc(`users/${ELLA}`).set(user(ELLA, 'elladelete'));
  await db.doc(`users/${HARPER}`).set(user(HARPER, 'harperdelete'));
  await db.doc(`users/${ELLA}/private/settings`).set({ uid: ELLA, phone: '+18035550100' });

  // Harper's look, which Ella liked and commented on.
  await db.doc('posts/post-harper').set({
    authorUid: HARPER,
    status: 'active',
    taggedListingIds: [],
    lastLiker: { uid: ELLA },
    stats: { likeCount: 1, commentCount: 1, saveCount: 0 },
  });
  await db.doc(`likes/${ELLA}_post-harper`).set({ uid: ELLA, postId: 'post-harper' });
  await db.doc('comments/c1').set({ authorUid: ELLA, postId: 'post-harper', status: 'active' });

  // They follow each other.
  await db.doc(`follows/${ELLA}_${HARPER}`).set({ followerUid: ELLA, followingUid: HARPER });
  await db.doc(`follows/${HARPER}_${ELLA}`).set({ followerUid: HARPER, followingUid: ELLA });

  // Ella's own look and piece.
  await db.doc('posts/post-ella').set({ authorUid: ELLA, status: 'active', taggedListingIds: [] });
  await db.doc('listings/listing-ella').set({ ownerUid: ELLA, status: 'active' });

  // A review Ella wrote about Harper after a finished rental.
  await db.doc('reviews/r1').set({ authorUid: ELLA, subjectUid: HARPER, author: { uid: ELLA } });
});

describe('deleteMyAccount', () => {
  it('needs a fresh password sign-in', async () => {
    expect(await attempt(request(ELLA, 60 * 60))).toMatch(/password/);
    expect((await db.doc(`users/${ELLA}`).get()).data()?.status).toBe('active');
  });

  it('refuses while a rental is still going, on either side', async () => {
    await db.doc('bookings/b1').set({ lenderUid: HARPER, renterUid: ELLA, status: 'with_renter' });
    expect(await attempt(request(ELLA))).toMatch(/rental still going/);
    expect((await db.doc(`users/${ELLA}`).get()).data()?.status).toBe('active');
  });

  it('lets a finished rental through, and keeps it', async () => {
    await db.doc('bookings/b1').set({ lenderUid: HARPER, renterUid: ELLA, status: 'completed' });
    expect(await attempt(request(ELLA))).toBe('ok');
    expect((await db.doc('bookings/b1').get()).exists).toBe(true);
  });

  it('removes what is hers and gives back other people’s counts', async () => {
    expect(await attempt(request(ELLA))).toBe('ok');

    const harperPost = (await db.doc('posts/post-harper').get()).data();
    expect(harperPost?.stats.likeCount).toBe(0);
    expect(harperPost?.stats.commentCount).toBe(0);
    expect(harperPost?.lastLiker).toBeNull();
    expect((await db.doc('comments/c1').get()).data()?.status).toBe('removed');

    const harper = (await db.doc(`users/${HARPER}`).get()).data();
    expect(harper?.stats.followerCount).toBe(0);
    expect(harper?.stats.followingCount).toBe(0);
    expect((await db.collection(COLLECTIONS.follows).get()).empty).toBe(true);

    expect((await db.doc('posts/post-ella').get()).data()?.status).toBe('removed');
    expect((await db.doc('listings/listing-ella').get()).data()?.status).toBe('removed');
    expect((await db.doc(`users/${ELLA}/private/settings`).get()).exists).toBe(false);
  });

  it('leaves a nameless shell, an anonymous review, and no login', async () => {
    expect(await attempt(request(ELLA))).toBe('ok');

    const shell = (await db.doc(`users/${ELLA}`).get()).data();
    expect(shell?.status).toBe('deactivated');
    expect(shell?.displayName).toBe(DELETED_ACCOUNT_NAME);
    expect(shell?.username).toBe(deletedUsername(ELLA));
    expect(shell?.photoUrl).toBeNull();
    expect(shell?.bio).toBe('');
    expect(shell?.deletedAt).toBeTruthy();

    const review = (await db.doc('reviews/r1').get()).data();
    expect(review?.author.displayName).toBe(DELETED_ACCOUNT_NAME);

    await expect(getAuth(app).getUser(ELLA)).rejects.toBeTruthy();
  });

  it('takes her out of her campus student count', async () => {
    await db
      .doc('campuses/university-of-south-carolina')
      .set({ name: 'University of South Carolina', stats: { userCount: 5 } });
    expect(await attempt(request(ELLA))).toBe('ok');
    const campus = (await db.doc('campuses/university-of-south-carolina').get()).data();
    expect(campus?.stats.userCount).toBe(4);
    await db.doc('campuses/university-of-south-carolina').delete();
  });

  it('refuses an admin', async () => {
    await db.doc(`users/${ELLA}`).update({ role: 'admin' });
    expect(await attempt(request(ELLA))).toMatch(/Admin accounts/);
  });

  it('copes with a like on a look that no longer exists', async () => {
    await db.doc(`likes/${ELLA}_gone`).set({ uid: ELLA, postId: 'post-that-is-gone' });
    expect(await attempt(request(ELLA))).toBe('ok');
    expect((await db.doc('posts/post-that-is-gone').get()).exists).toBe(false);
  });
});
