/**
 * "Trending this week" against the emulator.
 *
 *   - Saves, requests and tag taps from the last 7 days count.
 *   - Anything older than the week does not.
 *   - The owner's own saves, and another campus's pieces, do not.
 *   - The result lands in trending/{campusId}.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, type TrendingDoc } from '@loane/shared';

const PROJECT = 'demo-loane';
const CAMPUS = 'test-campus-trending';
const OTHER = 'test-campus-trending-other';
const DAY = 24 * 3_600_000;
const NOW = Date.now();

let app: App;
let db: Firestore;
let refresh: (campusId: string, nowMs?: number) => Promise<Omit<TrendingDoc, 'computedAt'>>;

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../listings/trending');
  refresh = mod.refreshTrendingForCampus;
});

afterAll(async () => {
  await deleteApp(app);
});

const at = (daysAgo: number) => Timestamp.fromMillis(NOW - daysAgo * DAY);

async function listing(id: string, ownerUid: string, campusId = CAMPUS, status = 'active') {
  await db.collection(COLLECTIONS.listings).doc(id).set({ ownerUid, campusId, status });
}

async function save(uid: string, listingId: string, daysAgo = 1, campusId = CAMPUS) {
  await db
    .collection(COLLECTIONS.saves)
    .doc(`${uid}_${listingId}`)
    .set({ uid, listingId, campusId, createdAt: at(daysAgo) });
}

beforeEach(async () => {
  for (const c of [
    COLLECTIONS.listings,
    COLLECTIONS.saves,
    COLLECTIONS.bookings,
    COLLECTIONS.events,
  ]) {
    const snap = await db.collection(c).where('campusId', 'in', [CAMPUS, OTHER]).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe('refreshTrendingForCampus', () => {
  it("counts the week's saves, requests and tag taps, once per person", async () => {
    await listing('t-dress', 'owner');
    await listing('t-top', 'owner');
    await save('u1', 't-dress');
    await save('u2', 't-dress');
    await db.collection(COLLECTIONS.bookings).add({
      campusId: CAMPUS,
      listingId: 't-top',
      renterUid: 'u1',
      createdAt: at(2),
    });
    for (const uid of ['u2', 'u2', 'u2']) {
      await db.collection(COLLECTIONS.events).add({
        campusId: CAMPUS,
        type: 'tagged_item_tap',
        uid,
        targetType: 'listing',
        targetId: 't-top',
        createdAt: at(1),
      });
    }

    const result = await refresh(CAMPUS, NOW);
    // dress: 2 saves × 2 = 4. top: 1 request × 4 + 1 tap × 1 = 5.
    expect(result.items).toEqual([
      { listingId: 't-top', score: 5, people: 2 },
      { listingId: 't-dress', score: 4, people: 2 },
    ]);

    const stored = (await db.collection(COLLECTIONS.trending).doc(CAMPUS).get()).data();
    expect(stored?.items).toEqual(result.items);
    expect(stored?.computedAt).toBeDefined();
  });

  it('ignores last week, the owner, and pieces from another campus', async () => {
    await listing('t-old', 'owner');
    await save('u1', 't-old', 8);
    await save('u2', 't-old', 9);

    await listing('t-mine', 'me');
    await save('me', 't-mine');
    await save('u1', 't-mine');

    await listing('t-away', 'owner', OTHER);
    await save('u1', 't-away', 1, CAMPUS);
    await save('u2', 't-away', 1, CAMPUS);

    const result = await refresh(CAMPUS, NOW);
    expect(result.items).toEqual([]);
  });
});
