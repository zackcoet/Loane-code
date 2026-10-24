/**
 * Sending a look, a piece or a profile into chats, against the emulator.
 *
 *   - It lands in one thread per friend, starting threads where needed,
 *     and the card is built from the real post/listing/profile — not
 *     whatever the phone said.
 *   - Duplicates and herself are dropped; more than ten at once is refused.
 *   - Friends she can't message (missing, suspended, blocked either way)
 *     are skipped quietly — and so is a friend who has a block with the
 *     person the card is ABOUT.
 *   - She can't share something from someone she has a block with; the
 *     answer is the same as "gone", so the block is never revealed.
 *   - Taken-down looks/pieces, sharing turned off, and junk input get a
 *     clear answer.
 *   - A look's share count goes up by how many it actually reached.
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
const ME = 'uid-me-share';
const ANNA = 'uid-anna-share';
const BETH = 'uid-beth-share';
const CARA = 'uid-cara-share';
const OWNER = 'uid-owner-share';

type Result = { sentTo: number; conversationId: string | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (req: CallableRequest<any>) => Promise<Result>;

let app: App;
let db: Firestore;
let sharePost: Fn;
let shareListing: Fn;
let shareProfile: Fn;

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

function student(uid: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    username: uid.replace(/[^a-z]/g, ''),
    displayName: uid,
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
    status: 'active',
    stats: { followerCount: 0, followingCount: 0 },
    ...extra,
  };
}

function summary(uid: string) {
  const s = student(uid);
  return {
    uid,
    username: s.username,
    displayName: s.displayName,
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
  };
}

async function block(blocker: string, blocked: string) {
  await db.doc(`${COLLECTIONS.users}/${blocker}/blocked/${blocked}`).set({ uid: blocked });
}

async function messages(a: string, b: string) {
  const snap = await db
    .collection(COLLECTIONS.conversations)
    .doc(ids.conversation(a, b))
    .collection(SUBCOLLECTIONS.messages)
    .get();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snap.docs.map((d) => d.data() as Record<string, any>);
}

async function shareCount() {
  return (await db.doc(`${COLLECTIONS.posts}/p1`).get()).data()?.stats?.shareCount ?? 0;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const post = await import('../messaging/sharePost');
  const listing = await import('../messaging/shareListing');
  const profile = await import('../messaging/shareProfile');
  sharePost = (req) => post.sharePost.run(req);
  shareListing = (req) => listing.shareListing.run(req);
  shareProfile = (req) => profile.shareProfile.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.conversations,
    COLLECTIONS.posts,
    COLLECTIONS.listings,
    COLLECTIONS.rateLimits,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  for (const uid of [ME, ANNA, BETH, CARA, OWNER]) {
    await db.doc(`${COLLECTIONS.users}/${uid}`).set(student(uid));
  }
  await db.doc(`${COLLECTIONS.posts}/p1`).set({
    id: 'p1',
    authorUid: OWNER,
    author: summary(OWNER),
    caption: 'x'.repeat(300),
    photos: [{ url: 'https://example.com/look.jpg' }],
    status: 'active',
    stats: { shareCount: 0 },
  });
  await db.doc(`${COLLECTIONS.listings}/l1`).set({
    id: 'l1',
    ownerUid: OWNER,
    owner: summary(OWNER),
    name: 'Red mini',
    intent: 'rent',
    pricing: { oneDayCents: 2500, threeDayCents: 4000, sevenDayCents: null },
    salePriceCents: null,
    coverUrl: 'https://example.com/dress.jpg',
    photos: [],
    status: 'active',
  });
});

describe('sharePost', () => {
  it('lands once in each friend’s chat with the real look, and counts the shares', async () => {
    const res = await sharePost(
      as(ME, { postId: 'p1', toUids: [ANNA, BETH, ANNA, ME], note: '  this! ' }),
    );
    expect(res).toEqual({ sentTo: 2, conversationId: null });
    for (const friend of [ANNA, BETH]) {
      const msgs = await messages(ME, friend);
      expect(msgs).toHaveLength(1);
      expect(msgs[0]?.body).toBe('this!');
      expect(msgs[0]?.senderUid).toBe(ME);
      expect(msgs[0]?.sharedPost?.postId).toBe('p1');
      expect(msgs[0]?.sharedPost?.authorUsername).toBe(summary(OWNER).username);
      expect(msgs[0]?.sharedPost?.caption).toHaveLength(140);
    }
    expect(await shareCount()).toBe(2);
  });

  it('hands back the chat to open when it went to exactly one friend', async () => {
    const res = await sharePost(as(ME, { postId: 'p1', toUids: [ANNA] }));
    expect(res).toEqual({ sentTo: 1, conversationId: ids.conversation(ME, ANNA) });
  });

  it('quietly skips friends she can’t message, and only counts the ones it reached', async () => {
    await db.doc(`${COLLECTIONS.users}/${BETH}`).update({ status: 'suspended' });
    await block(CARA, ME);
    const res = await sharePost(as(ME, { postId: 'p1', toUids: [ANNA, BETH, CARA, 'uid-nobody'] }));
    expect(res.sentTo).toBe(1);
    expect(await messages(ME, BETH)).toHaveLength(0);
    expect(await messages(ME, CARA)).toHaveLength(0);
    expect(await shareCount()).toBe(1);
  });

  it('skips a friend who has a block with the girl in the look', async () => {
    await block(OWNER, BETH);
    await block(CARA, OWNER);
    const res = await sharePost(as(ME, { postId: 'p1', toUids: [ANNA, BETH, CARA] }));
    expect(res.sentTo).toBe(1);
    expect(await messages(ME, BETH)).toHaveLength(0);
    expect(await messages(ME, CARA)).toHaveLength(0);
  });

  it('says it reached nobody when every friend was skipped', async () => {
    await block(OWNER, ANNA);
    expect(await attempt(() => sharePost(as(ME, { postId: 'p1', toUids: [ANNA] })))).toMatch(
      /could not send that to anyone/,
    );
    expect(await shareCount()).toBe(0);
  });

  it('answers "gone" when she has a block with the girl in the look', async () => {
    await block(OWNER, ME);
    expect(await attempt(() => sharePost(as(ME, { postId: 'p1', toUids: [ANNA] })))).toMatch(
      /That look is gone/,
    );
    await db.recursiveDelete(db.collection(COLLECTIONS.users).doc(OWNER).collection('blocked'));
    await block(ME, OWNER);
    expect(await attempt(() => sharePost(as(ME, { postId: 'p1', toUids: [ANNA] })))).toMatch(
      /That look is gone/,
    );
    expect(await messages(ME, ANNA)).toHaveLength(0);
  });

  it('refuses a taken-down look, sharing turned off, and a missing look', async () => {
    await db.doc(`${COLLECTIONS.posts}/p1`).update({ settings: { sharingDisabled: true } });
    expect(await attempt(() => sharePost(as(ME, { postId: 'p1', toUids: [ANNA] })))).toMatch(
      /Sharing is turned off/,
    );
    await db.doc(`${COLLECTIONS.posts}/p1`).update({ status: 'removed' });
    expect(await attempt(() => sharePost(as(ME, { postId: 'p1', toUids: [ANNA] })))).toMatch(
      /no longer up/,
    );
    expect(await attempt(() => sharePost(as(ME, { postId: 'p-x', toUids: [ANNA] })))).toMatch(
      /gone/,
    );
  });

  it('gives junk a clear answer, not a crash', async () => {
    expect(await attempt(() => sharePost(as(ME, { postId: 42, toUids: [ANNA] })))).toMatch(
      /Which look/,
    );
    expect(await attempt(() => sharePost(as(ME, { postId: 'p1', toUids: 'anna' })))).toMatch(
      /Pick someone/,
    );
    expect(await attempt(() => sharePost(as(ME, { postId: 'p1', toUids: [ME] })))).toMatch(
      /Pick someone/,
    );
    // A note that isn't text counts as no note.
    const res = await sharePost(as(ME, { postId: 'p1', toUids: [ANNA], note: 7 }));
    expect(res.sentTo).toBe(1);
    expect((await messages(ME, ANNA))[0]?.body).toBe('');
  });

  it('refuses more than ten friends at once', async () => {
    const many = Array.from({ length: 11 }, (_, i) => `uid-friend-${i}`);
    expect(await attempt(() => sharePost(as(ME, { postId: 'p1', toUids: many })))).toMatch(
      /10 people at a time/,
    );
  });
});

describe('shareListing', () => {
  it('sends a card built from the real piece', async () => {
    const res = await shareListing(as(ME, { listingId: 'l1', toUids: [ANNA] }));
    expect(res.sentTo).toBe(1);
    const card = (await messages(ME, ANNA))[0]?.sharedListing;
    expect(card).toMatchObject({
      listingId: 'l1',
      name: 'Red mini',
      rentFromCents: 2500,
      salePriceCents: null,
      photoUrl: 'https://example.com/dress.jpg',
    });
  });

  it('refuses a piece that isn’t up, and answers "gone" across a block', async () => {
    await block(ME, OWNER);
    expect(await attempt(() => shareListing(as(ME, { listingId: 'l1', toUids: [ANNA] })))).toMatch(
      /That piece is gone/,
    );
    await db.doc(`${COLLECTIONS.listings}/l1`).update({ status: 'paused' });
    expect(await attempt(() => shareListing(as(ME, { listingId: 'l1', toUids: [ANNA] })))).toMatch(
      /not available/,
    );
    expect(await attempt(() => shareListing(as(ME, { listingId: 9, toUids: [ANNA] })))).toMatch(
      /Which piece/,
    );
  });

  it('lets the owner share her own piece, and skips friends with a block with her', async () => {
    await block(BETH, OWNER);
    const res = await shareListing(as(OWNER, { listingId: 'l1', toUids: [ANNA, BETH] }));
    expect(res.sentTo).toBe(1);
    expect(await messages(OWNER, BETH)).toHaveLength(0);
  });
});

describe('shareProfile', () => {
  it('sends her real name and handle, and lets her share herself', async () => {
    await shareProfile(as(ME, { uid: OWNER, toUids: [ANNA] }));
    const card = (await messages(ME, ANNA))[0]?.sharedProfile;
    expect(card?.uid).toBe(OWNER);
    expect(card?.username).toBe(summary(OWNER).username);

    const res = await shareProfile(as(ME, { uid: ME, toUids: [BETH] }));
    expect(res.sentTo).toBe(1);
  });

  it('never puts her profile in front of someone she blocked', async () => {
    await block(OWNER, BETH);
    const res = await shareProfile(as(ME, { uid: OWNER, toUids: [ANNA, BETH] }));
    expect(res.sentTo).toBe(1);
    expect(await messages(ME, BETH)).toHaveLength(0);
  });

  it('refuses a suspended account, a block, and junk', async () => {
    await block(OWNER, ME);
    expect(await attempt(() => shareProfile(as(ME, { uid: OWNER, toUids: [ANNA] })))).toMatch(
      /not available/,
    );
    await db.doc(`${COLLECTIONS.users}/${CARA}`).update({ status: 'suspended' });
    expect(await attempt(() => shareProfile(as(ME, { uid: CARA, toUids: [ANNA] })))).toMatch(
      /not available/,
    );
    expect(await attempt(() => shareProfile(as(ME, { uid: ['x'], toUids: [ANNA] })))).toMatch(
      /Whose profile/,
    );
  });
});
