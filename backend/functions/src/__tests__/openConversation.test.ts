/**
 * Starting a chat, against the emulator.
 *
 *   - One thread per pair: opening it twice, from either side, is the same chat.
 *   - Never with herself, someone blocked either way, or a missing account.
 *   - No NEW chat with a deleted or suspended account — but an old one
 *     still opens, so she can scroll back.
 *   - The piece or rental the chat is "about" is kept only when it really
 *     belongs to these two; anything else is quietly dropped.
 *   - Junk input gets a clear answer, not a crash.
 *   - Opening a chat they already have doesn't move it in either inbox —
 *     only a message does.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, ids } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ME = 'uid-me-chat';
const ANNA = 'uid-anna-chat';
const BETH = 'uid-beth-chat';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let openConversation: (req: CallableRequest<any>) => Promise<{ conversationId: string }>;

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

async function open(from: string, data: Record<string, unknown>) {
  return (await openConversation(as(from, data))).conversationId;
}

async function thread(a: string, b: string) {
  return (await db.doc(`${COLLECTIONS.conversations}/${ids.conversation(a, b)}`).get()).data();
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../messaging/openConversation');
  openConversation = (req) => mod.openConversation.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.conversations,
    COLLECTIONS.listings,
    COLLECTIONS.bookings,
    COLLECTIONS.rateLimits,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  for (const uid of [ME, ANNA, BETH]) {
    await db.doc(`${COLLECTIONS.users}/${uid}`).set(student(uid));
  }
});

describe('openConversation', () => {
  it('makes one thread per pair, whoever opens it', async () => {
    const first = await open(ME, { withUid: ANNA });
    const second = await open(ANNA, { withUid: ME });
    expect(second).toBe(first);
    expect(first).toBe(ids.conversation(ME, ANNA));

    const data = await thread(ME, ANNA);
    expect(data?.participantUids).toEqual([ME, ANNA].sort());
    expect(data?.unreadCounts).toEqual({ [ME]: 0, [ANNA]: 0 });
  });

  it('refuses herself, a missing account and junk', async () => {
    expect(await attempt(() => open(ME, { withUid: ME }))).toMatch(/yourself/);
    expect(await attempt(() => open(ME, { withUid: 'uid-nobody' }))).toMatch(/could not find/);
    expect(await attempt(() => open(ME, { withUid: 42 }))).toMatch(/Who do you want/);
    expect(await attempt(() => open(ME, {}))).toMatch(/Who do you want/);
  });

  it('refuses when either of them has blocked the other', async () => {
    await db.doc(`${COLLECTIONS.users}/${ANNA}/blocked/${ME}`).set({ uid: ME });
    expect(await attempt(() => open(ME, { withUid: ANNA }))).not.toBe('ok');
    await db.doc(`${COLLECTIONS.users}/${ME}/blocked/${BETH}`).set({ uid: BETH });
    expect(await attempt(() => open(ME, { withUid: BETH }))).not.toBe('ok');
    expect(await thread(ME, ANNA)).toBeUndefined();
    expect(await thread(ME, BETH)).toBeUndefined();
  });

  it('starts no new chat with a deleted or suspended account', async () => {
    await db.doc(`${COLLECTIONS.users}/${ANNA}`).update({ status: 'suspended' });
    await db.doc(`${COLLECTIONS.users}/${BETH}`).update({ status: 'deactivated' });
    expect(await attempt(() => open(ME, { withUid: ANNA }))).toMatch(/could not find/);
    expect(await attempt(() => open(ME, { withUid: BETH }))).toMatch(/could not find/);
    expect(await thread(ME, ANNA)).toBeUndefined();
  });

  it('still opens a chat they already had after she is suspended', async () => {
    const id = await open(ME, { withUid: ANNA });
    await db.doc(`${COLLECTIONS.users}/${ANNA}`).update({ status: 'suspended' });
    expect(await open(ME, { withUid: ANNA })).toBe(id);
  });

  it('keeps a piece and a rental that belong to these two', async () => {
    await db.doc(`${COLLECTIONS.listings}/l-anna`).set({ ownerUid: ANNA, status: 'active' });
    await db
      .doc(`${COLLECTIONS.bookings}/b-ours`)
      .set({ lenderUid: ANNA, renterUid: ME, listingId: 'l-anna', status: 'confirmed' });
    await open(ME, { withUid: ANNA, listingId: 'l-anna', bookingId: 'b-ours' });

    const data = await thread(ME, ANNA);
    expect(data?.listingId).toBe('l-anna');
    expect(data?.bookingId).toBe('b-ours');
  });

  it("drops someone else's piece or rental, and a made-up one, but still opens the chat", async () => {
    await db.doc(`${COLLECTIONS.listings}/l-beth`).set({ ownerUid: BETH, status: 'active' });
    await db
      .doc(`${COLLECTIONS.bookings}/b-theirs`)
      .set({ lenderUid: BETH, renterUid: ANNA, listingId: 'l-beth', status: 'confirmed' });

    await open(ME, { withUid: ANNA, listingId: 'l-beth', bookingId: 'b-theirs' });
    let data = await thread(ME, ANNA);
    expect(data?.listingId).toBeNull();
    expect(data?.bookingId).toBeNull();

    await open(ME, { withUid: ANNA, listingId: 'l-nothing', bookingId: { not: 'a string' } });
    data = await thread(ME, ANNA);
    expect(data?.listingId).toBeNull();
    expect(data?.bookingId).toBeNull();
  });

  it('attaches a rental to the thread they already have, once', async () => {
    await open(ME, { withUid: ANNA });
    await db
      .doc(`${COLLECTIONS.bookings}/b-first`)
      .set({ lenderUid: ANNA, renterUid: ME, listingId: 'l', status: 'confirmed' });
    await db
      .doc(`${COLLECTIONS.bookings}/b-second`)
      .set({ lenderUid: ME, renterUid: ANNA, listingId: 'l2', status: 'confirmed' });

    await open(ANNA, { withUid: ME, bookingId: 'b-first' });
    await open(ME, { withUid: ANNA, bookingId: 'b-second' });
    expect((await thread(ME, ANNA))?.bookingId).toBe('b-first');
  });

  it('opening a chat they already have does not move it up either inbox', async () => {
    await open(ME, { withUid: ANNA });
    const ref = db.doc(`${COLLECTIONS.conversations}/${ids.conversation(ME, ANNA)}`);
    const stamp = new Date('2026-01-01T12:00:00Z');
    await ref.update({ updatedAt: stamp });
    await db.doc(`${COLLECTIONS.users}/${ANNA}`).update({ displayName: 'Anna New' });

    await open(ME, { withUid: ANNA });
    await open(ANNA, { withUid: ME });

    const data = await thread(ME, ANNA);
    expect(data?.updatedAt.toDate().toISOString()).toBe(stamp.toISOString());
    // Her name on the thread is still kept up to date.
    expect(data?.participants[ANNA].displayName).toBe('Anna New');
  });
});
