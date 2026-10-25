/**
 * A lender blocking days on her piece's calendar, against the emulator.
 *
 *   - Only the owner, only real dates, only a listed piece.
 *   - A day a confirmed rental has is refused, in a friendly date.
 *   - A day that was blocked and then got booked never traps her.
 *   - Old days are dropped so they don't fill the yearly limit.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'university-of-south-carolina';
const OWNER = 'uid-owner-blocked';
const OTHER = 'uid-other-blocked';
const LISTING = 'listing-blocked';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let setBlockedDates: (req: CallableRequest<any>) => Promise<any>;

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
    status: 'active',
  };
}

async function blocked(): Promise<string[]> {
  return (await db.doc(`${COLLECTIONS.listings}/${LISTING}`).get()).data()?.blackoutDates;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../bookings/lifecycle');
  setBlockedDates = (req) => mod.setBlockedDates.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.users, COLLECTIONS.listings, COLLECTIONS.bookings]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${OWNER}`).set(student(OWNER));
  await db.doc(`${COLLECTIONS.users}/${OTHER}`).set(student(OTHER));
  await db.doc(`${COLLECTIONS.listings}/${LISTING}`).set({
    id: LISTING,
    ownerUid: OWNER,
    campusId: CAMPUS,
    status: 'active',
    blackoutDates: [],
  });
});

describe('setBlockedDates', () => {
  it('saves her days sorted, once each, and drops long-gone ones', async () => {
    const result = await setBlockedDates(
      as(OWNER, {
        listingId: LISTING,
        dates: ['2099-03-02', '2099-03-01', '2099-03-02', '2020-01-01'],
      }),
    );
    expect(result).toEqual({ blocked: ['2099-03-01', '2099-03-02'] });
    expect(await blocked()).toEqual(['2099-03-01', '2099-03-02']);
  });

  it('refuses a day a confirmed rental already has', async () => {
    await db.doc(`${COLLECTIONS.bookings}/b1`).set({
      listingId: LISTING,
      lenderUid: OWNER,
      renterUid: OTHER,
      status: 'confirmed',
      startDate: '2099-03-01',
      endDate: '2099-03-03',
    });
    expect(
      await attempt(() =>
        setBlockedDates(as(OWNER, { listingId: LISTING, dates: ['2099-03-02'] })),
      ),
    ).toMatch(/already booked/);
    expect(await blocked()).toEqual([]);
  });

  it('does not trap her when a blocked day later got booked', async () => {
    await db.doc(`${COLLECTIONS.listings}/${LISTING}`).update({ blackoutDates: ['2099-03-01'] });
    await db.doc(`${COLLECTIONS.bookings}/b1`).set({
      listingId: LISTING,
      lenderUid: OWNER,
      renterUid: OTHER,
      status: 'confirmed',
      startDate: '2099-03-01',
      endDate: '2099-03-02',
    });
    const result = await setBlockedDates(
      as(OWNER, { listingId: LISTING, dates: ['2099-03-01', '2099-04-01'] }),
    );
    expect(result).toEqual({ blocked: ['2099-04-01'] });
  });

  it("refuses someone else's piece, a removed one, and junk", async () => {
    expect(
      await attempt(() => setBlockedDates(as(OTHER, { listingId: LISTING, dates: [] }))),
    ).toMatch(/not your listing/);
    expect(
      await attempt(() => setBlockedDates(as(OWNER, { listingId: LISTING, dates: ['soon'] }))),
    ).toMatch(/did not come through/);
    expect(await attempt(() => setBlockedDates(as(OWNER, { listingId: 7 })))).toMatch(
      /Which piece/,
    );
    await db.doc(`${COLLECTIONS.listings}/${LISTING}`).update({ status: 'removed' });
    expect(
      await attempt(() =>
        setBlockedDates(as(OWNER, { listingId: LISTING, dates: ['2099-03-01'] })),
      ),
    ).toMatch(/no longer listed/);
  });
});
