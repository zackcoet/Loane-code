/**
 * The background jobs behind the inbox preview, tag labels on looks and
 * a piece's greyed-out calendar — against the emulator.
 *
 *   onMessageCreated / onMessageLiked: the preview only ever moves
 *   forward, whichever run finishes last; the same message counted
 *   twice is one unread; a heart older than the newest message leaves
 *   it alone.
 *
 *   refreshTagLabels: copies the piece as it is now, not as the event
 *   remembers it; leaves a look that no longer tags it alone.
 *
 *   syncListingAvailability: booked days from every rental that holds
 *   the piece; a removed piece is skipped without an error.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, LIKED_MESSAGE_PREVIEW } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ELLA = 'uid-ella-inbox';
const HARPER = 'uid-harper-inbox';
const CHAT = `${ELLA}_${HARPER}`;
const T1 = '2026-10-26T04:00:00.000Z';
const T2 = '2026-10-26T04:00:05.000Z';

type Run = (event: unknown) => Promise<unknown>;
let app: App;
let db: Firestore;
let messageCreated: Run;
let messageLiked: Run;
let refreshLabels: Run;
let syncDates: Run;

function message(id: string, senderUid: string, body: string, extra = {}) {
  return {
    id,
    conversationId: CHAT,
    senderUid,
    body,
    photo: null,
    sharedPost: null,
    sharedListing: null,
    sharedProfile: null,
    replyTo: null,
    readBy: [senderUid],
    likedBy: [],
    isDeleted: false,
    ...extra,
  };
}

function created(messageId: string, row: unknown, time: string) {
  return {
    params: { conversationId: CHAT, messageId },
    time,
    data: { data: () => row },
  };
}

function changed(params: Record<string, string>, before: unknown, after: unknown, time = T2) {
  return {
    params,
    time,
    data: { before: { data: () => before }, after: { data: () => after } },
  };
}

async function get(path: string) {
  return (await db.doc(path).get()).data()!;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const c = await import('../triggers/onMessageCreated');
  const l = await import('../triggers/onMessageLiked');
  const r = await import('../triggers/refreshTagLabels');
  const s = await import('../triggers/syncListingAvailability');
  messageCreated = (ev) => c.onMessageCreated.run(ev as never);
  messageLiked = (ev) => l.onMessageLiked.run(ev as never);
  refreshLabels = (ev) => r.refreshTagLabels.run(ev as never);
  syncDates = (ev) => s.syncListingAvailability.run(ev as never);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.conversations,
    COLLECTIONS.listings,
    COLLECTIONS.posts,
    COLLECTIONS.bookings,
    COLLECTIONS.reports,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
});

describe('the inbox preview', () => {
  const chatPath = `${COLLECTIONS.conversations}/${CHAT}`;

  beforeEach(async () => {
    await db.doc(chatPath).set({
      id: CHAT,
      campusId: CAMPUS,
      participantUids: [ELLA, HARPER],
      participants: {},
      listingId: null,
      bookingId: null,
      lastMessage: null,
      unreadCounts: {},
      updatedAt: Timestamp.fromDate(new Date('2026-01-01')),
    });
  });

  it('shows the message, counts it unread for her, and marks the sender as having written', async () => {
    await messageCreated(created('m1', message('m1', ELLA, 'hey!'), T1));
    const chat = await get(chatPath);
    expect(chat.lastMessage.body).toBe('hey!');
    expect(chat.lastMessage.senderUid).toBe(ELLA);
    expect(chat.lastMessage.messageId).toBe('m1');
    expect((chat.lastMessage.sentAt as Timestamp).toDate().toISOString()).toBe(T1);
    expect(chat.unreadCounts[HARPER]).toBe(1);
    expect(chat.unreadCounts[ELLA]).toBeUndefined();
    expect(chat.repliedUids).toEqual([ELLA]);
  });

  it('keeps the newer message on top when the older one is summarized last', async () => {
    await messageCreated(created('m2', message('m2', ELLA, 'second'), T2));
    await messageCreated(created('m1', message('m1', ELLA, 'first'), T1));
    const chat = await get(chatPath);
    expect(chat.lastMessage.body).toBe('second');
    // Both still count.
    expect(chat.unreadCounts[HARPER]).toBe(2);
  });

  it('counts the same message once even if the job runs twice', async () => {
    const ev = created('m1', message('m1', ELLA, 'hey!'), T1);
    await messageCreated(ev);
    await messageCreated(ev);
    expect((await get(chatPath)).unreadCounts[HARPER]).toBe(1);
  });

  it('a heart from before the newest message leaves the preview alone', async () => {
    await messageCreated(created('m2', message('m2', ELLA, 'newest'), T2));
    const before = message('m1', ELLA, 'older');
    const after = { ...before, likedBy: [HARPER] };
    await messageLiked(changed({ conversationId: CHAT, messageId: 'm1' }, before, after, T1));
    const chat = await get(chatPath);
    expect(chat.lastMessage.body).toBe('newest');
    expect(chat.unreadCounts[ELLA]).toBeUndefined();
  });

  it('a heart after the newest message shows as “Liked a message”', async () => {
    await messageCreated(created('m1', message('m1', ELLA, 'cute fit'), T1));
    const before = message('m1', ELLA, 'cute fit');
    const after = { ...before, likedBy: [HARPER] };
    await messageLiked(changed({ conversationId: CHAT, messageId: 'm1' }, before, after, T2));
    const chat = await get(chatPath);
    expect(chat.lastMessage.body).toBe(LIKED_MESSAGE_PREVIEW);
    expect(chat.lastMessage.senderUid).toBe(HARPER);
    expect(chat.unreadCounts[ELLA]).toBe(1);
  });

  it('a message in a thread that is gone does nothing', async () => {
    await db.doc(chatPath).delete();
    await expect(
      messageCreated(created('m1', message('m1', ELLA, 'hey'), T1)),
    ).resolves.not.toThrow();
    expect((await db.doc(chatPath).get()).exists).toBe(false);
  });

  it('still sends a flagged message to the admin queue', async () => {
    await messageCreated(created('m1', message('m1', ELLA, 'just kys'), T1));
    const reports = await db.collection(COLLECTIONS.reports).get();
    expect(reports.size).toBe(1);
    expect(reports.docs[0]!.data().targetId).toBe(`${CHAT}/m1`);
  });
});

describe('refreshTagLabels', () => {
  const tag = (listingId: string, name: string) => ({
    listingId,
    x: 0.4,
    y: 0.6,
    ownerUid: ELLA,
    label: {
      name,
      coverUrl: null,
      priceCents3Day: 1000,
      salePriceCents: null,
      ownerUsername: 'ella',
    },
  });

  function piece(name: string, threeDayCents: number) {
    return {
      id: 'l1',
      ownerUid: ELLA,
      owner: { uid: ELLA, username: 'ella' },
      name,
      coverUrl: null,
      category: 'dresses',
      pricing: { oneDayCents: null, threeDayCents, sevenDayCents: null },
      salePriceCents: null,
    };
  }

  function look(id: string, taggedListingIds: string[]) {
    return {
      id,
      authorUid: ELLA,
      taggedListingIds,
      photos: [{ url: 'u', tags: taggedListingIds.map((l) => tag(l, 'Old name')) }],
      taggedListings: taggedListingIds.map((l) => ({
        listingId: l,
        name: 'Old name',
        coverUrl: null,
        priceCents3Day: 1000,
        salePriceCents: null,
      })),
    };
  }

  it('copies the piece as it is now, even from an older event', async () => {
    await db.doc(`${COLLECTIONS.listings}/l1`).set(piece('Newest name', 3000));
    await db.doc(`${COLLECTIONS.posts}/p1`).set(look('p1', ['l1']));
    // The event is the FIRST of two quick edits: it knows only "Middle".
    await refreshLabels(
      changed({ listingId: 'l1' }, piece('Old name', 1000), piece('Middle name', 2000)),
    );
    const p = await get(`${COLLECTIONS.posts}/p1`);
    expect(p.photos[0].tags[0].label.name).toBe('Newest name');
    expect(p.photos[0].tags[0].label.priceCents3Day).toBe(3000);
    expect(p.photos[0].tags[0].x).toBe(0.4);
    expect(p.taggedListings[0].name).toBe('Newest name');
  });

  it('updates every look that tags it, and only that tag', async () => {
    await db.doc(`${COLLECTIONS.listings}/l1`).set(piece('New', 2000));
    await db.doc(`${COLLECTIONS.posts}/p1`).set(look('p1', ['l1', 'l2']));
    await db.doc(`${COLLECTIONS.posts}/p2`).set(look('p2', ['l1']));
    await db.doc(`${COLLECTIONS.posts}/p3`).set(look('p3', ['l2']));
    await refreshLabels(changed({ listingId: 'l1' }, piece('Old', 1000), piece('New', 2000)));

    const p1 = await get(`${COLLECTIONS.posts}/p1`);
    expect(p1.photos[0].tags.map((t: { label: { name: string } }) => t.label.name)).toEqual([
      'New',
      'Old name',
    ]);
    expect((await get(`${COLLECTIONS.posts}/p2`)).photos[0].tags[0].label.name).toBe('New');
    expect((await get(`${COLLECTIONS.posts}/p3`)).photos[0].tags[0].label.name).toBe('Old name');
  });

  it('does nothing when nothing on the label changed', async () => {
    await db.doc(`${COLLECTIONS.listings}/l1`).set(piece('Same', 1000));
    await db.doc(`${COLLECTIONS.posts}/p1`).set(look('p1', ['l1']));
    await refreshLabels(
      changed({ listingId: 'l1' }, piece('Same', 1000), {
        ...piece('Same', 1000),
        description: 'new words',
      }),
    );
    expect((await get(`${COLLECTIONS.posts}/p1`)).photos[0].tags[0].label.name).toBe('Old name');
  });

  it('does nothing once the piece is gone', async () => {
    await db.doc(`${COLLECTIONS.posts}/p1`).set(look('p1', ['l1']));
    await refreshLabels(changed({ listingId: 'l1' }, piece('Old', 1000), piece('New', 2000)));
    expect((await get(`${COLLECTIONS.posts}/p1`)).photos[0].tags[0].label.name).toBe('Old name');
  });
});

describe('syncListingAvailability', () => {
  function booking(id: string, status: string, startDate: string | null, endDate: string | null) {
    return { id, listingId: 'l1', status, startDate, endDate };
  }

  async function seed(...rows: ReturnType<typeof booking>[]) {
    await db.doc(`${COLLECTIONS.listings}/l1`).set({ id: 'l1', bookedDates: ['2020-01-01'] });
    for (const row of rows) await db.doc(`${COLLECTIONS.bookings}/${row.id}`).set(row);
  }

  it('greys out every night a confirmed or out rental holds', async () => {
    const yes = booking('b1', 'confirmed', '2026-11-06', '2026-11-08');
    await seed(
      yes,
      booking('b2', 'with_renter', '2026-11-01', '2026-11-02'),
      booking('b3', 'requested', '2026-11-20', '2026-11-22'),
      booking('b4', 'cancelled', '2026-11-25', '2026-11-26'),
      booking('b5', 'confirmed', null, null),
    );
    await syncDates(changed({ bookingId: 'b1' }, { ...yes, status: 'requested' }, yes));
    expect((await get(`${COLLECTIONS.listings}/l1`)).bookedDates).toEqual([
      '2026-11-01',
      '2026-11-06',
      '2026-11-07',
    ]);
  });

  it('frees the days when a rental is cancelled', async () => {
    const off = booking('b1', 'cancelled', '2026-11-06', '2026-11-08');
    await seed(off);
    await syncDates(changed({ bookingId: 'b1' }, { ...off, status: 'confirmed' }, off));
    expect((await get(`${COLLECTIONS.listings}/l1`)).bookedDates).toEqual([]);
  });

  it('skips a piece that has been removed, without an error', async () => {
    const yes = booking('b1', 'confirmed', '2026-11-06', '2026-11-08');
    await db.doc(`${COLLECTIONS.bookings}/b1`).set(yes);
    await expect(
      syncDates(changed({ bookingId: 'b1' }, { ...yes, status: 'requested' }, yes)),
    ).resolves.not.toThrow();
    expect((await db.doc(`${COLLECTIONS.listings}/l1`).get()).exists).toBe(false);
  });

  it('ignores a change that cannot move any dates', async () => {
    const yes = booking('b1', 'confirmed', '2026-11-06', '2026-11-08');
    await seed(yes);
    await syncDates(changed({ bookingId: 'b1' }, yes, { ...yes, handoffNote: 'by the fountain' }));
    expect((await get(`${COLLECTIONS.listings}/l1`)).bookedDates).toEqual(['2020-01-01']);
  });
});
