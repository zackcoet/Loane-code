/**
 * Taking a piece off Loane, against the emulator.
 *
 *   - Only the owner can, and junk input gets a clear answer.
 *   - Nothing is deleted: the piece is marked removed, and says whether
 *     it had rentals (kept for the record).
 *   - A rental that's waiting, confirmed, out, or in a complaint blocks it.
 *   - Removing twice is harmless.
 *   - After it's removed, nobody can ask to rent it.
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
const OWNER = 'uid-owner-remove';
const OTHER = 'uid-other-remove';
const LISTING = 'listing-remove';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let removeListing: (req: CallableRequest<any>) => Promise<any>;

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

async function booking(id: string, status: string) {
  await db
    .doc(`${COLLECTIONS.bookings}/${id}`)
    .set({ listingId: LISTING, lenderUid: OWNER, renterUid: OTHER, status });
}

async function listingStatus() {
  return (await db.doc(`${COLLECTIONS.listings}/${LISTING}`).get()).data()?.status;
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../listings/removeListing');
  removeListing = (req) => mod.removeListing.run(req);
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
  await db
    .doc(`${COLLECTIONS.listings}/${LISTING}`)
    .set({ id: LISTING, ownerUid: OWNER, campusId: CAMPUS, status: 'active' });
});

describe('removeListing', () => {
  it('takes a piece with no rentals down, without deleting it', async () => {
    const result = await removeListing(as(OWNER, { listingId: LISTING }));
    expect(result).toEqual({ keptForHistory: false, bookingCount: 0 });
    const snap = await db.doc(`${COLLECTIONS.listings}/${LISTING}`).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.status).toBe('removed');
    expect(snap.data()?.removedAt).toBeTruthy();
  });

  it('says a piece with finished rentals is kept for the record', async () => {
    await booking('b-done', 'completed');
    await booking('b-no', 'declined');
    const result = await removeListing(as(OWNER, { listingId: LISTING }));
    expect(result).toEqual({ keptForHistory: true, bookingCount: 2 });
    expect(await listingStatus()).toBe('removed');
  });

  it.each(['requested', 'confirmed', 'with_renter', 'disputed'])(
    'refuses while a rental is %s',
    async (status) => {
      await booking('b-live', status);
      expect(await attempt(() => removeListing(as(OWNER, { listingId: LISTING })))).toMatch(
        /rental in progress/,
      );
      expect(await listingStatus()).toBe('active');
    },
  );

  it("refuses someone else's piece, a missing one and junk", async () => {
    expect(await attempt(() => removeListing(as(OTHER, { listingId: LISTING })))).toMatch(
      /not your listing/,
    );
    expect(await attempt(() => removeListing(as(OWNER, { listingId: 'nope' })))).toMatch(
      /no longer listed/,
    );
    expect(await attempt(() => removeListing(as(OWNER, { listingId: 7 })))).toMatch(/Which piece/);
    expect(await attempt(() => removeListing(as(OWNER, {})))).toMatch(/Which piece/);
    expect(await listingStatus()).toBe('active');
  });

  it('removing twice is harmless', async () => {
    await removeListing(as(OWNER, { listingId: LISTING }));
    const again = await removeListing(as(OWNER, { listingId: LISTING }));
    expect(again).toEqual({ keptForHistory: false, bookingCount: 0 });
    expect(await listingStatus()).toBe('removed');
  });
});
