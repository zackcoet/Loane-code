/**
 * The hourly booking sweep, against the emulator.
 *
 *   - An unanswered request past its deadline is declined, and both
 *     sides are told; one still in time is left alone.
 *   - A return nobody complained about is completed and counted once.
 *   - Each reminder goes out once, however many times the sweep runs.
 *   - Only admins can run it by hand.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, addDays, campusClock, toIsoDate } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ELLA = 'uid-ella-sweep'; // lender
const HARPER = 'uid-harper-sweep'; // renter
const LISTING = 'listing-sweep-dress';

type Fn = (req: CallableRequest<unknown>) => Promise<unknown>;
let app: App;
let db: Firestore;
let runBookingSweep: Fn;

const admin = { auth: { uid: 'uid-admin', token: { admin: true } }, data: {} } as never;
const notAdmin = { auth: { uid: HARPER, token: {} }, data: {} } as never;

function summary(uid: string, username: string) {
  return {
    uid,
    username,
    displayName: username,
    photoUrl: null,
    campusId: CAMPUS,
    isVerified: true,
  };
}

const hoursFromNow = (h: number) => Timestamp.fromMillis(Date.now() + h * 3600_000);

async function booking(id: string, fields: Record<string, unknown>) {
  await db.doc(`${COLLECTIONS.bookings}/${id}`).set({
    id,
    kind: 'rental',
    listingId: LISTING,
    campusId: CAMPUS,
    lenderUid: ELLA,
    renterUid: HARPER,
    lender: summary(ELLA, 'ellasweep'),
    renter: summary(HARPER, 'harpersweep'),
    listing: { name: 'Red gameday dress' },
    startDate: addDays(toIsoDate(new Date()), 10),
    endDate: addDays(toIsoDate(new Date()), 13),
    expiresAt: null,
    disputeWindowEndsAt: null,
    declineReason: null,
    timeline: {},
    ...fields,
  });
}

async function read(id: string) {
  return (await db.doc(`${COLLECTIONS.bookings}/${id}`).get()).data()!;
}

async function alerts(uid: string, title: string) {
  const snap = await db.collection(`${COLLECTIONS.users}/${uid}/notifications`).get();
  return snap.docs.filter((d) => d.data().title === title).length;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const sweep = await import('../bookings/sweep');
  runBookingSweep = (r) => sweep.runBookingSweep.run(r as never);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.users, COLLECTIONS.listings, COLLECTIONS.bookings]) {
    await db.recursiveDelete(db.collection(c));
  }
  for (const [uid, name] of [
    [ELLA, 'ellasweep'],
    [HARPER, 'harpersweep'],
  ]) {
    await db.doc(`${COLLECTIONS.users}/${uid}`).set({
      ...summary(uid!, name!),
      status: 'active',
      stats: { rentalsAsLender: 0, rentalsAsRenter: 0 },
    });
  }
  await db.doc(`${COLLECTIONS.listings}/${LISTING}`).set({
    id: LISTING,
    ownerUid: ELLA,
    status: 'active',
    stats: { completedRentals: 0 },
  });
});

describe('requests nobody answered', () => {
  it('declined once past the deadline, and both sides are told', async () => {
    await booking('late', { status: 'requested', expiresAt: hoursFromNow(-1) });
    await booking('fresh', { status: 'requested', expiresAt: hoursFromNow(20) });

    await runBookingSweep(admin);

    const late = await read('late');
    expect(late.status).toBe('declined');
    expect(late.declineReason).toBe('No answer in time');
    expect(await alerts(HARPER, 'Request expired')).toBe(1);
    expect(await alerts(ELLA, 'You missed a request')).toBe(1);
    expect((await read('fresh')).status).toBe('requested');
  });
});

describe('returns nobody flagged', () => {
  it('completed and counted once, even if the sweep runs twice', async () => {
    await booking('back', { status: 'returned', disputeWindowEndsAt: hoursFromNow(-1) });

    await runBookingSweep(admin);
    await runBookingSweep(admin);

    expect((await read('back')).status).toBe('completed');
    const lender = (await db.doc(`${COLLECTIONS.users}/${ELLA}`).get()).data()!;
    expect(lender.stats.rentalsAsLender).toBe(1);
  });

  it('a return still inside its window is left alone', async () => {
    await booking('back', { status: 'returned', disputeWindowEndsAt: hoursFromNow(10) });
    await runBookingSweep(admin);
    expect((await read('back')).status).toBe('returned');
  });
});

describe('reminders', () => {
  it('"starts tomorrow" goes out once, however often the sweep runs', async () => {
    // Campus time, the same "today" the sweep uses.
    const today = campusClock().today;
    await booking('soon', {
      status: 'confirmed',
      startDate: addDays(today, 1),
      endDate: addDays(today, 4),
    });

    await runBookingSweep(admin);
    await runBookingSweep(admin);

    expect(await alerts(HARPER, 'Your rental starts tomorrow')).toBe(1);
    expect(await alerts(ELLA, 'You are lending tomorrow')).toBe(1);
  });
});

describe('reminders, continued', () => {
  it('"due back today" goes out once, and never after she has handed it back', async () => {
    const today = campusClock().today;
    await booking('due', { status: 'with_renter', startDate: addDays(today, -2), endDate: today });
    await booking('handed', { status: 'returned', startDate: addDays(today, -2), endDate: today });

    await runBookingSweep(admin);
    await runBookingSweep(admin);

    expect(await alerts(HARPER, 'Due back today')).toBe(1);
    expect((await read('due')).remindersSent).toEqual({ dueToday: true });
    expect((await read('handed')).remindersSent).toBeUndefined();
  });

  it('overdue tells both girls once', async () => {
    const today = campusClock().today;
    await booking('late', {
      status: 'with_renter',
      startDate: addDays(today, -5),
      endDate: addDays(today, -1),
    });
    await runBookingSweep(admin);
    await runBookingSweep(admin);
    expect(await alerts(HARPER, 'This is overdue')).toBe(1);
    expect(await alerts(ELLA, 'A rental is overdue')).toBe(1);
  });

  it('a rental weeks away gets nothing yet', async () => {
    await booking('later', { status: 'confirmed' }); // starts in 10 days
    await runBookingSweep(admin);
    expect((await read('later')).remindersSent).toBeUndefined();
  });
});

describe('a request about to expire', () => {
  it('nudges the lender once, and the alert opens the request', async () => {
    await booking('ticking', { status: 'requested', expiresAt: hoursFromNow(3) });
    // Not every saved booking carries its own id inside it.
    await db.doc(`${COLLECTIONS.bookings}/ticking`).update({ id: FieldValue.delete() });

    await runBookingSweep(admin);
    await runBookingSweep(admin);

    const snap = await db.collection(`${COLLECTIONS.users}/${ELLA}/notifications`).get();
    const nudges = snap.docs.filter((d) => d.data().title === 'A request is about to expire');
    expect(nudges).toHaveLength(1);
    expect(nudges[0]!.data().deepLink).toBe('/rental/ticking');
  });

  it('leaves a request with plenty of time alone', async () => {
    await booking('fresh', { status: 'requested', expiresAt: hoursFromNow(20) });
    await runBookingSweep(admin);
    expect(await alerts(ELLA, 'A request is about to expire')).toBe(0);
  });
});

describe('running it by hand', () => {
  it('admins only', async () => {
    await expect(runBookingSweep(notAdmin)).rejects.toBeTruthy();
  });
});
