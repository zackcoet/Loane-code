/**
 * Writing and editing a review, against the emulator.
 *
 *   - Only somebody in a finished rental can review it, once.
 *   - Her stars are worked out from the visible reviews, so a review an
 *     admin took down counts for nothing — even after a new one arrives.
 *   - A review that was taken down cannot be rewritten.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS } from '@loane/shared';

const PROJECT = 'demo-loane';
const ELLA = 'uid-ella-review'; // the lender being rated
const HARPER = 'uid-harper-review'; // the renter writing
const MADDIE = 'uid-maddie-review'; // not in the rental

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let write: (req: CallableRequest<any>) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let edit: (req: CallableRequest<any>) => Promise<any>;

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

function student(uid: string, username: string) {
  return {
    uid,
    username,
    displayName: username,
    photoUrl: null,
    campusId: 'university-of-south-carolina',
    isVerified: true,
    status: 'active',
    stats: { ratingCount: 0, ratingAverage: null },
  };
}

function booking(id: string, status = 'completed') {
  return db.doc(`${COLLECTIONS.bookings}/${id}`).set({
    id,
    campusId: 'university-of-south-carolina',
    listingId: 'ella-dress',
    lenderUid: ELLA,
    renterUid: HARPER,
    status,
    reviews: { lenderReviewId: null, renterReviewId: null },
  });
}

async function ellaStats() {
  const snap = await db.doc(`${COLLECTIONS.users}/${ELLA}`).get();
  return snap.data()!.stats as { ratingCount: number; ratingAverage: number | null };
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../reviews/writeReview');
  write = (req) => mod.writeReview.run(req);
  edit = (req) => mod.editReview.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.users,
    COLLECTIONS.bookings,
    COLLECTIONS.reviews,
    COLLECTIONS.notifications,
  ]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${ELLA}`).set(student(ELLA, 'ellareview'));
  await db.doc(`${COLLECTIONS.users}/${HARPER}`).set(student(HARPER, 'harperreview'));
  await db.doc(`${COLLECTIONS.users}/${MADDIE}`).set(student(MADDIE, 'maddiereview'));
});

describe('writeReview', () => {
  it('a renter rates the lender of a finished rental, and her stars update', async () => {
    await booking('b1');
    expect(
      await attempt(() => write(as(HARPER, { bookingId: 'b1', rating: 4, body: 'Cute!' }))),
    ).toBe('ok');
    expect(await ellaStats()).toEqual({ ratingCount: 1, ratingAverage: 4 });
  });

  it('only once per rental', async () => {
    await booking('b1');
    await write(as(HARPER, { bookingId: 'b1', rating: 4, body: '' }));
    expect(
      await attempt(() => write(as(HARPER, { bookingId: 'b1', rating: 5, body: '' }))),
    ).toMatch(/already reviewed/);
  });

  it('nobody outside the rental can review it', async () => {
    await booking('b1');
    expect(
      await attempt(() => write(as(MADDIE, { bookingId: 'b1', rating: 1, body: '' }))),
    ).toMatch(/not yours/);
  });

  it('not before the rental is finished', async () => {
    await booking('b1', 'active');
    expect(
      await attempt(() => write(as(HARPER, { bookingId: 'b1', rating: 5, body: '' }))),
    ).toMatch(/once the rental is finished/);
  });

  it('a review an admin took down stays out of her stars when a new one arrives', async () => {
    // The old arithmetic trusted the stored count, so a stale or
    // hand-fixed number carried forward. Now it is read from the reviews.
    await db.doc(`${COLLECTIONS.reviews}/old-hidden`).set({
      subjectUid: ELLA,
      rating: 1,
      isHidden: true,
    });
    await db.doc(`${COLLECTIONS.reviews}/old-visible`).set({
      subjectUid: ELLA,
      rating: 5,
      isHidden: false,
    });
    await booking('b1');
    await write(as(HARPER, { bookingId: 'b1', rating: 4, body: '' }));
    expect(await ellaStats()).toEqual({ ratingCount: 2, ratingAverage: 4.5 });
  });
});

describe('editReview', () => {
  it('re-scoring swaps the old score for the new one', async () => {
    await booking('b1');
    const { reviewId } = await write(as(HARPER, { bookingId: 'b1', rating: 2, body: '' }));
    expect(
      await attempt(() => edit(as(HARPER, { reviewId, rating: 5, body: 'Changed my mind' }))),
    ).toBe('ok');
    expect(await ellaStats()).toEqual({ ratingCount: 1, ratingAverage: 5 });
  });

  it('only the author can change it', async () => {
    await booking('b1');
    const { reviewId } = await write(as(HARPER, { bookingId: 'b1', rating: 2, body: '' }));
    expect(await attempt(() => edit(as(ELLA, { reviewId, rating: 5, body: '' })))).toMatch(
      /not your review/,
    );
  });

  it('a review that was taken down cannot be rewritten, and her stars do not move', async () => {
    await booking('b1');
    const { reviewId } = await write(as(HARPER, { bookingId: 'b1', rating: 1, body: 'mean' }));
    // What an admin's takedown leaves behind.
    await db.doc(`${COLLECTIONS.reviews}/${reviewId}`).update({ isHidden: true });
    await db
      .doc(`${COLLECTIONS.users}/${ELLA}`)
      .update({ 'stats.ratingCount': 0, 'stats.ratingAverage': null });

    expect(await attempt(() => edit(as(HARPER, { reviewId, rating: 5, body: 'nice' })))).toMatch(
      /taken down/,
    );
    expect(await ellaStats()).toEqual({ ratingCount: 0, ratingAverage: null });
  });
});
