/**
 * The background jobs that keep copies and counters honest — against the
 * emulator.
 *
 *   propagateProfileChanges: a new name or photo reaches her pieces,
 *   looks, comments, reviews, chats and rentals still going (finished ones keep
 *   the name they had); uses the newest profile even when the
 *   event is stale; does not reorder anyone's inbox; and a look deleted
 *   mid-run does not stop the rest.
 *
 *   countListingView / countPostEngagement: views and tagged-piece taps
 *   count, her own don't, junk ids are ignored, and a tap only credits
 *   the look that really tags that piece.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ELLA = 'uid-ella-copies';
const HARPER = 'uid-harper-copies';
const OLD_TIME = Timestamp.fromDate(new Date('2026-01-01T12:00:00Z'));

type Run = (event: unknown) => Promise<unknown>;
let app: App;
let db: Firestore;
let propagate: Run;
let countView: Run;
let countPost: Run;

function user(uid: string, username: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    username,
    displayName: username,
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
    role: 'student',
    status: 'active',
    ...extra,
  };
}

function updated(uid: string, before: unknown, after: unknown) {
  return {
    params: { uid },
    data: { before: { data: () => before }, after: { data: () => after } },
  };
}

function created(row: Record<string, unknown>) {
  return { params: { eventId: 'e' }, data: { data: () => row } };
}

function appEvent(
  type: string,
  uid: string,
  targetId: unknown,
  meta: Record<string, unknown> = {},
) {
  return { type, uid, campusId: CAMPUS, targetId, meta, surface: 'feed' };
}

async function get(path: string) {
  return (await db.doc(path).get()).data()!;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const p = await import('../triggers/propagateProfileChanges');
  const v = await import('../triggers/countListingView');
  const e = await import('../triggers/countPostEngagement');
  propagate = (ev) => p.propagateProfileChanges.run(ev as never);
  countView = (ev) => v.countListingView.run(ev as never);
  countPost = (ev) => e.countPostEngagement.run(ev as never);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.listings,
    COLLECTIONS.posts,
    COLLECTIONS.comments,
    COLLECTIONS.conversations,
    COLLECTIONS.bookings,
    COLLECTIONS.reviews,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
});

describe('propagateProfileChanges', () => {
  async function seedHerThings() {
    const old = user(ELLA, 'ellaold');
    await db.doc(`${COLLECTIONS.listings}/l1`).set({ ownerUid: ELLA, owner: old });
    await db.doc(`${COLLECTIONS.posts}/p1`).set({ authorUid: ELLA, author: old });
    await db.doc(`${COLLECTIONS.posts}/p2`).set({ authorUid: ELLA, author: old });
    await db.doc(`${COLLECTIONS.comments}/c1`).set({ authorUid: ELLA, author: old });
    await db.doc(`${COLLECTIONS.conversations}/chat1`).set({
      participantUids: [ELLA, HARPER],
      participants: { [ELLA]: old, [HARPER]: user(HARPER, 'harper') },
      updatedAt: OLD_TIME,
    });
    return old;
  }

  it('puts her new name on every piece, look, comment and chat', async () => {
    const old = await seedHerThings();
    const now = user(ELLA, 'ellanew');
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(now);
    await propagate(updated(ELLA, old, now));

    expect((await get(`${COLLECTIONS.listings}/l1`)).owner.username).toBe('ellanew');
    expect((await get(`${COLLECTIONS.posts}/p1`)).author.username).toBe('ellanew');
    expect((await get(`${COLLECTIONS.comments}/c1`)).author.username).toBe('ellanew');
    const chat = await get(`${COLLECTIONS.conversations}/chat1`);
    expect(chat.participants[ELLA].username).toBe('ellanew');
    // The other girl's copy is untouched.
    expect(chat.participants[HARPER].username).toBe('harper');
  });

  it('does not move the chat up anyone’s inbox', async () => {
    const old = await seedHerThings();
    const now = user(ELLA, 'ellaold', { photoUrl: 'https://example.com/new.jpg' });
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(now);
    await propagate(updated(ELLA, old, now));

    const chat = await get(`${COLLECTIONS.conversations}/chat1`);
    expect(chat.participants[ELLA].photoUrl).toBe('https://example.com/new.jpg');
    expect((chat.updatedAt as Timestamp).toMillis()).toBe(OLD_TIME.toMillis());
  });

  it('copies the newest profile even when the event it was given is stale', async () => {
    const old = await seedHerThings();
    // She renamed twice; this run is for the FIRST rename and finishes last.
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(user(ELLA, 'ellasecond'));
    await propagate(updated(ELLA, old, user(ELLA, 'ellafirst')));

    expect((await get(`${COLLECTIONS.posts}/p1`)).author.username).toBe('ellasecond');
    const chat = await get(`${COLLECTIONS.conversations}/chat1`);
    expect(chat.participants[ELLA].username).toBe('ellasecond');
  });

  it('does nothing for an edit nobody else sees', async () => {
    const old = await seedHerThings();
    const now = { ...old, bio: 'new bio' };
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(now);
    await propagate(updated(ELLA, old, now));
    expect((await get(`${COLLECTIONS.posts}/p1`)).updatedAt).toBeUndefined();
  });

  it('a look deleted while it runs does not stop the rest', async () => {
    const old = await seedHerThings();
    const now = user(ELLA, 'ellanew');
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(now);
    // Delete a look in the gap between the job reading it and writing it.
    const run = propagate(updated(ELLA, old, now));
    await db.doc(`${COLLECTIONS.posts}/p2`).delete();
    await run;

    expect((await db.doc(`${COLLECTIONS.posts}/p2`).get()).exists).toBe(false);
    expect((await get(`${COLLECTIONS.posts}/p1`)).author.username).toBe('ellanew');
    const chat = await get(`${COLLECTIONS.conversations}/chat1`);
    expect(chat.participants[ELLA].username).toBe('ellanew');
  });
});

describe('propagateProfileChanges on reviews', () => {
  it('puts her new name on reviews she wrote, without marking them edited', async () => {
    const old = user(ELLA, 'ellaold');
    await db.doc(`${COLLECTIONS.reviews}/r1`).set({
      authorUid: ELLA,
      author: old,
      subjectUid: HARPER,
      rating: 5,
      body: 'Lovely',
      updatedAt: OLD_TIME,
    });
    // A review ABOUT her is somebody else's words and copy.
    await db.doc(`${COLLECTIONS.reviews}/r2`).set({
      authorUid: HARPER,
      author: user(HARPER, 'harper'),
      subjectUid: ELLA,
      rating: 4,
      body: 'Nice',
    });
    const now = user(ELLA, 'ellanew');
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(now);
    await propagate(updated(ELLA, old, now));

    const mine = await get(`${COLLECTIONS.reviews}/r1`);
    expect(mine.author.username).toBe('ellanew');
    expect(mine.body).toBe('Lovely');
    expect((mine.updatedAt as Timestamp).toMillis()).toBe(OLD_TIME.toMillis());
    expect((await get(`${COLLECTIONS.reviews}/r2`)).author.username).toBe('harper');
  });
});

describe('propagateProfileChanges on rentals', () => {
  async function booking(id: string, status: string, ellaSide: 'lender' | 'renter') {
    const old = user(ELLA, 'ellaold');
    const harper = user(HARPER, 'harper');
    const ellaLends = ellaSide === 'lender';
    await db.doc(`${COLLECTIONS.bookings}/${id}`).set({
      status,
      listingId: 'piece1',
      lenderUid: ellaLends ? ELLA : HARPER,
      renterUid: ellaLends ? HARPER : ELLA,
      lender: ellaLends ? old : harper,
      renter: ellaLends ? harper : old,
      startDate: '2026-11-07',
      endDate: '2026-11-08',
      updatedAt: OLD_TIME,
    });
    return old;
  }

  it('puts her new name on rentals still going, on whichever side she is', async () => {
    const old = await booking('b-lend', 'confirmed', 'lender');
    await booking('b-rent', 'with_renter', 'renter');
    await booking('b-asked', 'requested', 'renter');
    await booking('b-claim', 'disputed', 'lender');
    const now = user(ELLA, 'ellanew');
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(now);
    await propagate(updated(ELLA, old, now));

    const lent = await get(`${COLLECTIONS.bookings}/b-lend`);
    expect(lent.lender.username).toBe('ellanew');
    expect(lent.renter.username).toBe('harper');
    expect((await get(`${COLLECTIONS.bookings}/b-rent`)).renter.username).toBe('ellanew');
    expect((await get(`${COLLECTIONS.bookings}/b-asked`)).renter.username).toBe('ellanew');
    expect((await get(`${COLLECTIONS.bookings}/b-claim`)).lender.username).toBe('ellanew');
  });

  it('leaves finished rentals with the name they had', async () => {
    const old = await booking('b-done', 'completed', 'lender');
    await booking('b-off', 'cancelled', 'renter');
    await booking('b-no', 'declined', 'renter');
    const now = user(ELLA, 'ellanew');
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(now);
    await propagate(updated(ELLA, old, now));

    expect((await get(`${COLLECTIONS.bookings}/b-done`)).lender.username).toBe('ellaold');
    expect((await get(`${COLLECTIONS.bookings}/b-off`)).renter.username).toBe('ellaold');
    expect((await get(`${COLLECTIONS.bookings}/b-no`)).renter.username).toBe('ellaold');
  });

  it('changes only her copy: not the status, dates or when it last moved', async () => {
    const old = await booking('b-lend', 'confirmed', 'lender');
    const now = user(ELLA, 'ellaold', { photoUrl: 'https://example.com/new.jpg' });
    await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(now);
    await propagate(updated(ELLA, old, now));

    const b = await get(`${COLLECTIONS.bookings}/b-lend`);
    expect(b.lender.photoUrl).toBe('https://example.com/new.jpg');
    expect(b.status).toBe('confirmed');
    expect(b.startDate).toBe('2026-11-07');
    expect((b.updatedAt as Timestamp).toMillis()).toBe(OLD_TIME.toMillis());
  });
});

describe('view and tag-tap counters', () => {
  beforeEach(async () => {
    await db.doc(`${COLLECTIONS.listings}/piece1`).set({ ownerUid: ELLA, stats: { viewCount: 0 } });
    await db.doc(`${COLLECTIONS.listings}/piece2`).set({ ownerUid: ELLA, stats: { viewCount: 0 } });
    await db.doc(`${COLLECTIONS.posts}/look1`).set({
      authorUid: ELLA,
      taggedListingIds: ['piece1'],
      stats: { viewCount: 0, tagTapCount: 0 },
    });
  });

  async function listingViews(id: string) {
    return (await get(`${COLLECTIONS.listings}/${id}`)).stats.viewCount;
  }
  async function look() {
    return (await get(`${COLLECTIONS.posts}/look1`)).stats;
  }

  it('counts someone else opening a piece, not the owner', async () => {
    await countView(created(appEvent('listing_view', HARPER, 'piece1')));
    await countView(created(appEvent('listing_view', ELLA, 'piece1')));
    expect(await listingViews('piece1')).toBe(1);
  });

  it('ignores junk piece ids instead of crashing', async () => {
    await expect(
      countView(created(appEvent('listing_view', HARPER, 'piece1/extra'))),
    ).resolves.toBeUndefined();
    await expect(countView(created(appEvent('listing_view', HARPER, 42)))).resolves.toBeUndefined();
    await expect(
      countView(created(appEvent('listing_view', HARPER, 'gone'))),
    ).resolves.toBeUndefined();
    expect(await listingViews('piece1')).toBe(0);
  });

  it('counts look views, not the author’s own', async () => {
    await countPost(created(appEvent('post_view', HARPER, 'look1')));
    await countPost(created(appEvent('post_view', ELLA, 'look1')));
    expect((await look()).viewCount).toBe(1);
  });

  it('credits a tag tap to the look that tags that piece', async () => {
    await countPost(created(appEvent('tagged_item_tap', HARPER, 'piece1', { postId: 'look1' })));
    expect((await look()).tagTapCount).toBe(1);
  });

  it('does not credit a look for a piece it never tagged', async () => {
    await countPost(created(appEvent('tagged_item_tap', HARPER, 'piece2', { postId: 'look1' })));
    expect((await look()).tagTapCount).toBe(0);
  });

  it('ignores junk look ids and her own taps', async () => {
    await expect(
      countPost(created(appEvent('tagged_item_tap', HARPER, 'piece1', { postId: { a: 1 } }))),
    ).resolves.toBeUndefined();
    await expect(
      countPost(created(appEvent('tagged_item_tap', HARPER, 'piece1', { postId: 'a/b' }))),
    ).resolves.toBeUndefined();
    await countPost(created(appEvent('tagged_item_tap', ELLA, 'piece1', { postId: 'look1' })));
    expect((await look()).tagTapCount).toBe(0);
  });
});
