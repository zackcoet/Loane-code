/**
 * When a piece sells, nobody is left waiting on it — against the emulator.
 *
 *   - Saying yes to a buyer answers every other open request for the
 *     piece, rentals too, and tells each girl it was sold.
 *   - Saying yes to a rental leaves the others alone.
 *   - A new rental request for a piece she has agreed to sell is refused
 *     up front, rather than sitting there until it times out.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, addDays, toIsoDate } from '@loane/shared';

const START = addDays(toIsoDate(new Date()), 20);

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const ELLA = 'uid-ella-sold'; // the lender
const HARPER = 'uid-harper-sold'; // first buyer
const MAYA = 'uid-maya-sold'; // second buyer
const ZOE = 'uid-zoe-sold'; // wants to rent it
const LISTING = 'listing-sold-top';

type Fn = (req: CallableRequest<unknown>) => Promise<unknown>;
let app: App;
let db: Firestore;
let respondToBooking: Fn;
let requestBooking: Fn;
let SOLD_ELSEWHERE: string;

function as(uid: string, data: unknown): CallableRequest<unknown> {
  return {
    auth: { uid, token: { email_verified: true } },
    data,
    rawRequest: { ip: '127.0.0.1', headers: {} },
  } as unknown as CallableRequest<unknown>;
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
    photoUrl: 'https://example.com/me.jpg',
    campusId: CAMPUS,
    isVerified: true,
    role: 'student',
    status: 'active',
  };
}

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

const NAMES: Record<string, string> = {
  [HARPER]: 'harpersold',
  [MAYA]: 'mayasold',
  [ZOE]: 'zoesold',
};

async function request(
  id: string,
  renterUid: string,
  kind: 'rental' | 'purchase',
  status = 'requested',
) {
  await db.doc(`${COLLECTIONS.bookings}/${id}`).set({
    id,
    kind,
    listingId: LISTING,
    campusId: CAMPUS,
    lenderUid: ELLA,
    renterUid,
    lender: summary(ELLA, 'ellasold'),
    renter: summary(renterUid, NAMES[renterUid]!),
    listing: { name: 'Black lace top' },
    status,
    startDate: kind === 'rental' ? START : null,
    endDate: kind === 'rental' ? addDays(START, 3) : null,
    declineReason: null,
    timeline: {},
  });
}

async function booking(id: string) {
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
  const lifecycle = await import('../bookings/lifecycle');
  const requesting = await import('../bookings/requestBooking');
  respondToBooking = (r) => lifecycle.respondToBooking.run(r as never);
  requestBooking = (r) => requesting.requestBooking.run(r as never);
  SOLD_ELSEWHERE = lifecycle.SOLD_ELSEWHERE;
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.listings,
    COLLECTIONS.bookings,
    COLLECTIONS.conversations,
    COLLECTIONS.rateLimits,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(student(ELLA, 'ellasold'));
  for (const [uid, name] of Object.entries(NAMES)) {
    await db.doc(`${COLLECTIONS.users}/${uid}`).set(student(uid, name));
    await db
      .doc(`${COLLECTIONS.users}/${uid}/private/settings`)
      .set({ uid, phone: '+18035550101' });
  }
  await db.doc(`${COLLECTIONS.users}/${ELLA}/private/settings`).set({
    uid: ELLA,
    phone: '+18035550100',
  });
  await db.doc(`${COLLECTIONS.listings}/${LISTING}`).set({
    id: LISTING,
    ownerUid: ELLA,
    campusId: CAMPUS,
    name: 'Black lace top',
    status: 'active',
    intent: 'both',
    pricing: { dailyCents: 1500 },
    garmentValueCents: 6000,
    blackoutDates: [],
  });
});

describe('saying yes to a buyer', () => {
  it('answers every other open request, rentals too, and tells each girl', async () => {
    await request('b1', HARPER, 'purchase');
    await request('b2', MAYA, 'purchase');
    await request('b3', ZOE, 'rental');

    expect(await attempt(() => respondToBooking(as(ELLA, { bookingId: 'b1', accept: true })))).toBe(
      'ok',
    );

    expect((await booking('b1')).status).toBe('confirmed');
    for (const id of ['b2', 'b3']) {
      const b = await booking(id);
      expect(b.status).toBe('declined');
      expect(b.declineReason).toBe(SOLD_ELSEWHERE);
    }
    expect(await alerts(MAYA, 'That piece was sold')).toBe(1);
    expect(await alerts(ZOE, 'That piece was sold')).toBe(1);
    expect(await alerts(HARPER, 'That piece was sold')).toBe(0);
  });

  it('leaves bookings that are already over alone', async () => {
    await request('b1', HARPER, 'purchase');
    await request('b2', MAYA, 'purchase', 'cancelled');

    await respondToBooking(as(ELLA, { bookingId: 'b1', accept: true }));
    expect((await booking('b2')).status).toBe('cancelled');
    expect(await alerts(MAYA, 'That piece was sold')).toBe(0);
  });
});

describe('saying yes to a rental', () => {
  it('leaves the other requests open', async () => {
    await request('b1', ZOE, 'rental');
    await request('b2', MAYA, 'purchase');

    await respondToBooking(as(ELLA, { bookingId: 'b1', accept: true }));
    expect((await booking('b2')).status).toBe('requested');
  });
});

describe('asking to rent a piece she agreed to sell', () => {
  it('is refused up front', async () => {
    await request('b1', HARPER, 'purchase', 'confirmed');
    expect(
      await attempt(() =>
        requestBooking(
          as(ZOE, {
            listingId: LISTING,
            startDate: addDays(START, 10),
            endDate: addDays(START, 13),
          }),
        ),
      ),
    ).toMatch(/being sold to someone else/);
  });
});
