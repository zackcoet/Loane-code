/**
 * Deciding a flagged return from the dashboard, against the emulator.
 *
 *   - Admins only; it needs an outcome and a note; junk gets a clear answer.
 *   - It closes the rental as completed, carrying the decision, and
 *     counts it once in both histories and on the piece.
 *   - Two admins deciding at once count it once, not twice.
 *   - Only a disputed rental can be decided.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ADMIN = 'uid-admin-dispute';
const ADMIN_2 = 'uid-admin-dispute-2';
const LENDER = 'uid-lender-dispute';
const RENTER = 'uid-renter-dispute';

let app: App;
let db: Firestore;
let resolve: (req: CallableRequest<unknown>) => Promise<unknown>;

function as(uid: string, data: unknown, admin = true): CallableRequest<unknown> {
  return {
    auth: { uid, token: { admin, email: 'admin@joinloane.com' } },
    data,
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

async function stats(path: string) {
  return (await db.doc(path).get()).data()?.stats;
}

const GOOD = { bookingId: 'b1', outcome: 'renter_at_fault', notes: 'Stain in the photos' };

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT }, 'resolve-dispute-test');
  db = getFirestore(app);
  const mod = await import('../admin/resolveDispute');
  resolve = (req) => mod.resolveDispute.run(req as never);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const uid of [LENDER, RENTER]) {
    await db.recursiveDelete(db.doc(`${COLLECTIONS.users}/${uid}`));
    await db.doc(`${COLLECTIONS.users}/${uid}`).set({
      uid,
      status: 'active',
      stats: { rentalsAsLender: 0, rentalsAsRenter: 0 },
    });
  }
  await db.doc(`${COLLECTIONS.listings}/l-dispute`).set({
    id: 'l-dispute',
    ownerUid: LENDER,
    status: 'active',
    stats: { completedRentals: 0 },
  });
  await db.doc(`${COLLECTIONS.bookings}/b1`).set({
    id: 'b1',
    kind: 'rental',
    status: 'disputed',
    listingId: 'l-dispute',
    lenderUid: LENDER,
    renterUid: RENTER,
    listing: { name: 'Red mini' },
    returnProblem: { type: 'damage', note: 'stain', photos: [] },
    disputeWindowEndsAt: new Date(),
    timeline: {},
    lender: { username: 'lender' },
    renter: { username: 'renter' },
  });
  const audit = await db
    .collection(COLLECTIONS.adminActions)
    .where('action', '==', 'resolve_dispute')
    .get();
  for (const doc of audit.docs) await doc.ref.delete();
});

async function auditCount() {
  return (
    await db.collection(COLLECTIONS.adminActions).where('action', '==', 'resolve_dispute').get()
  ).size;
}

describe('resolveDispute', () => {
  it('closes the rental with the decision and counts it once everywhere', async () => {
    await resolve(as(ADMIN, GOOD));

    const booking = (await db.doc(`${COLLECTIONS.bookings}/b1`).get()).data();
    expect(booking?.status).toBe('completed');
    expect(booking?.disputeWindowEndsAt).toBeNull();
    expect(booking?.disputeResolution).toMatchObject({
      outcome: 'renter_at_fault',
      notes: 'Stain in the photos',
      adminUid: ADMIN,
    });
    expect((await stats(`${COLLECTIONS.users}/${LENDER}`)).rentalsAsLender).toBe(1);
    expect((await stats(`${COLLECTIONS.users}/${RENTER}`)).rentalsAsRenter).toBe(1);
    expect((await stats(`${COLLECTIONS.listings}/l-dispute`)).completedRentals).toBe(1);
    expect(await auditCount()).toBe(1);

    for (const uid of [LENDER, RENTER]) {
      const notes = await db.collection(`${COLLECTIONS.users}/${uid}/notifications`).get();
      const byType = Object.fromEntries(notes.docs.map((d) => [d.data().type, d.data()]));
      expect(byType.claim_resolved?.body).toBe('Red mini: Stain in the photos');
      // Ends like any finished rental: both are asked for a review.
      expect(byType.review_requested).toBeDefined();
      expect(notes.size).toBe(2);
    }
    // A rental leaves the piece as it was.
    expect((await db.doc(`${COLLECTIONS.listings}/l-dispute`).get()).data()?.status).toBe('active');
  });

  it('a disputed sale from before run 43 ends with the piece sold', async () => {
    await db.doc(`${COLLECTIONS.bookings}/b1`).update({ kind: 'purchase' });
    await resolve(as(ADMIN, GOOD));
    expect((await db.doc(`${COLLECTIONS.listings}/l-dispute`).get()).data()?.status).toBe('sold');
    const notes = await db.collection(`${COLLECTIONS.users}/${RENTER}/notifications`).get();
    expect(notes.docs.map((d) => d.data().title)).toContain('Loane reviewed your sale');
  });

  it('a sale on a taken-down piece keeps it down, remembered as sold', async () => {
    await db.doc(`${COLLECTIONS.bookings}/b1`).update({ kind: 'purchase' });
    await db
      .doc(`${COLLECTIONS.listings}/l-dispute`)
      .update({ status: 'suspended', statusBeforeSuspension: 'active' });
    await resolve(as(ADMIN, GOOD));
    const piece = (await db.doc(`${COLLECTIONS.listings}/l-dispute`).get()).data();
    expect(piece?.status).toBe('suspended');
    expect(piece?.statusBeforeSuspension).toBe('sold');
  });

  it('counts it once when two admins decide at the same moment', async () => {
    const results = await Promise.all([
      attempt(() => resolve(as(ADMIN, GOOD))),
      attempt(() => resolve(as(ADMIN_2, { ...GOOD, outcome: 'no_fault' }))),
    ]);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.find((r) => r !== 'ok')).toMatch(/already decided/);
    expect((await stats(`${COLLECTIONS.users}/${LENDER}`)).rentalsAsLender).toBe(1);
    expect((await stats(`${COLLECTIONS.listings}/l-dispute`)).completedRentals).toBe(1);
    expect(await auditCount()).toBe(1);
  });

  it('refuses a rental that is not disputed', async () => {
    await db.doc(`${COLLECTIONS.bookings}/b1`).update({ status: 'returned' });
    expect(await attempt(() => resolve(as(ADMIN, GOOD)))).toMatch(/not disputed/);
    expect((await stats(`${COLLECTIONS.users}/${LENDER}`)).rentalsAsLender).toBe(0);
  });

  it('refuses a student, a missing rental, and junk', async () => {
    expect(await attempt(() => resolve(as(LENDER, GOOD, false)))).toMatch(/Admins only/);
    expect(await attempt(() => resolve(as(ADMIN, { ...GOOD, bookingId: 'nope' })))).toMatch(
      /could not find/,
    );
    for (const bookingId of [{ a: 1 }, 7, '', 'a/b']) {
      expect(await attempt(() => resolve(as(ADMIN, { ...GOOD, bookingId })))).toMatch(
        /Which rental/,
      );
    }
    for (const outcome of ['everyone_wins', ['renter_at_fault'], undefined]) {
      expect(await attempt(() => resolve(as(ADMIN, { ...GOOD, outcome })))).toMatch(
        /Pick an outcome/,
      );
    }
    expect(await attempt(() => resolve(as(ADMIN, { ...GOOD, notes: 5 })))).toMatch(
      /Write what you decided/,
    );
    expect((await db.doc(`${COLLECTIONS.bookings}/b1`).get()).data()?.status).toBe('disputed');
    expect(await auditCount()).toBe(0);
  });
});
