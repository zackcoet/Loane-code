/**
 * Add to Closet and Edit Listing, against the emulator.
 *
 *   - A new piece is saved with her name and photo copied from her
 *     profile, whatever the phone claimed, and counters at zero.
 *   - An id that is already taken is refused (no landing on another piece).
 *   - Editing: only her own piece, only while it is hers to manage, and
 *     counters, dates and history are left exactly as they were.
 *   - Photos already on a piece are kept; new ones must be her uploads.
 *   - Sixty new pieces an hour; edits are not counted.
 *   - Suspended or unverified accounts can't put anything on Loane.
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
const OWNER = 'uid-owner-write';
const OTHER = 'uid-other-write';

let app: App;
let db: Firestore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let writeListing: (req: CallableRequest<any>) => Promise<any>;

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

function student(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    username: uid.replace(/[^a-z]/g, ''),
    displayName: `Real ${uid}`,
    photoUrl: 'https://example.com/me.jpg',
    campusId: CAMPUS,
    isVerified: true,
    emailConfirmed: true,
    status: 'active',
    ...overrides,
  };
}

function urlFor(path: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${PROJECT}.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=t`;
}

function photo(uid: string, listingId: string, file = '0-1.jpg') {
  const path = `users/${uid}/listings/${listingId}/${file}`;
  return { path, url: urlFor(path), width: 1200, height: 1600 };
}

function piece(listingId: string, overrides: Record<string, unknown> = {}) {
  return {
    listingId,
    isNew: true,
    name: 'Vintage Silk Slip Dress',
    description: 'Worn once',
    brand: 'Reformation',
    category: 'dresses',
    size: 'S',
    shoeSize: null,
    condition: 'like_new',
    occasions: ['formal'],
    intent: 'rent',
    oneDayCents: 1500,
    threeDayCents: 2500,
    sevenDayCents: 4000,
    salePriceCents: null,
    garmentValueCents: 12000,
    cleaningFeeCents: null,
    photos: [photo(OWNER, listingId)],
    flatPhoto: null,
    sameDay: false,
    availableNow: true,
    ...overrides,
  };
}

async function read(listingId: string) {
  return (await db.doc(`${COLLECTIONS.listings}/${listingId}`).get()).data();
}

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const mod = await import('../listings/writeListing');
  writeListing = (req) => mod.writeListing.run(req);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const c of [COLLECTIONS.users, COLLECTIONS.listings, COLLECTIONS.rateLimits]) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(`${COLLECTIONS.users}/${OWNER}`).set(student(OWNER));
  await db.doc(`${COLLECTIONS.users}/${OTHER}`).set(student(OTHER));
});

describe('writeListing — a new piece', () => {
  it('saves it with her name from her profile and counters at zero', async () => {
    const result = await writeListing(
      as(OWNER, piece('new-1', { owner: { displayName: 'Somebody Famous' } })),
    );
    expect(result).toEqual({ listingId: 'new-1' });

    const saved = await read('new-1');
    expect(saved?.ownerUid).toBe(OWNER);
    expect(saved?.campusId).toBe(CAMPUS);
    expect(saved?.owner.displayName).toBe(`Real ${OWNER}`);
    expect(saved?.owner.photoUrl).toBe('https://example.com/me.jpg');
    expect(saved?.stats).toEqual({ viewCount: 0, saveCount: 0, tagCount: 0, completedRentals: 0 });
    expect(saved?.status).toBe('active');
    expect(saved?.coverUrl).toBe(photo(OWNER, 'new-1').url);
    expect(saved?.blackoutDates).toEqual([]);
    expect(saved?.requiresApproval).toBe(true);
    expect(saved?.createdAt).toBeTruthy();
  });

  it('saves "Available now" off as paused', async () => {
    await writeListing(as(OWNER, piece('new-paused', { availableNow: false })));
    expect((await read('new-paused'))?.status).toBe('paused');
  });

  it('keeps only the prices that match rent or sell', async () => {
    await writeListing(
      as(OWNER, piece('new-sell', { intent: 'sell', salePriceCents: 3000, cleaningFeeCents: 500 })),
    );
    const saved = await read('new-sell');
    expect(saved?.pricing).toEqual({ oneDayCents: null, threeDayCents: null, sevenDayCents: null });
    expect(saved?.cleaningFeeCents).toBeNull();
    expect(saved?.salePriceCents).toBe(3000);
  });

  it('refuses an id that is already taken', async () => {
    await writeListing(as(OTHER, piece('taken', { photos: [photo(OTHER, 'taken')] })));
    expect(await attempt(() => writeListing(as(OWNER, piece('taken'))))).toMatch(/Try again/);
    expect((await read('taken'))?.ownerUid).toBe(OTHER);
  });

  it('refuses a photo that is not her own upload for this piece', async () => {
    const outside = { path: 'x.jpg', url: 'https://example.com/x.jpg', width: 1, height: 1 };
    expect(
      await attempt(() => writeListing(as(OWNER, piece('web', { photos: [outside] })))),
    ).toMatch(/upload/);
    expect(
      await attempt(() =>
        writeListing(as(OWNER, piece('theirs', { photos: [photo(OTHER, 'theirs')] }))),
      ),
    ).toMatch(/upload/);
    expect(
      await attempt(() =>
        writeListing(as(OWNER, piece('flat', { flatPhoto: photo(OTHER, 'flat', 'flat.png') }))),
      ),
    ).toMatch(/upload/);
    expect(await read('web')).toBeUndefined();
  });

  it('stops at sixty new pieces an hour', async () => {
    await db
      .doc(`${COLLECTIONS.rateLimits}/listing__${OWNER}`)
      .set({ count: 60, windowStartedAt: new Date() });
    expect(await attempt(() => writeListing(as(OWNER, piece('sixty-one'))))).toMatch(
      /lot on Loane in the last hour/,
    );
  });

  it('turns away suspended and unverified accounts', async () => {
    await db.doc(`${COLLECTIONS.users}/${OWNER}`).set(student(OWNER, { status: 'suspended' }));
    expect(await attempt(() => writeListing(as(OWNER, piece('sus'))))).toMatch(/suspended/);
    await db.doc(`${COLLECTIONS.users}/${OWNER}`).set(student(OWNER, { isVerified: false }));
    expect(await attempt(() => writeListing(as(OWNER, piece('unv'))))).toMatch(/Verify/);
  });
});

describe('writeListing — editing', () => {
  beforeEach(async () => {
    await writeListing(as(OWNER, piece('mine')));
    // What other parts of Loane write onto a piece over its life.
    await db.doc(`${COLLECTIONS.listings}/mine`).update({
      'stats.saveCount': 7,
      blackoutDates: ['2026-11-07'],
      bookedDates: ['2026-11-14'],
      'sameDay.premiumBps': 2500,
      colorNames: ['ivory'],
    });
  });

  it('changes what the form shows and nothing else', async () => {
    await writeListing(as(OWNER, piece('mine', { isNew: false, name: 'Ivory Slip Dress' })));
    const saved = await read('mine');
    expect(saved?.name).toBe('Ivory Slip Dress');
    expect(saved?.stats.saveCount).toBe(7);
    expect(saved?.blackoutDates).toEqual(['2026-11-07']);
    expect(saved?.bookedDates).toEqual(['2026-11-14']);
    expect(saved?.sameDay.premiumBps).toBe(2500);
    expect(saved?.colorNames).toEqual(['ivory']);
  });

  it('does not count edits against the hourly limit', async () => {
    await db
      .doc(`${COLLECTIONS.rateLimits}/listing__${OWNER}`)
      .set({ count: 60, windowStartedAt: new Date() });
    expect(await attempt(() => writeListing(as(OWNER, piece('mine', { isNew: false }))))).toBe(
      'ok',
    );
  });

  it('keeps a photo already on the piece, wherever it lives', async () => {
    const seeded = {
      path: 'seed/1.jpg',
      url: 'data:image/jpeg;base64,AAAA',
      width: 600,
      height: 800,
    };
    await db.doc(`${COLLECTIONS.listings}/mine`).update({ photos: [seeded] });
    expect(
      await attempt(() =>
        writeListing(as(OWNER, piece('mine', { isNew: false, name: 'Renamed', photos: [seeded] }))),
      ),
    ).toBe('ok');
    expect((await read('mine'))?.photos).toEqual([seeded]);
  });

  it('refuses a new photo that is not her upload', async () => {
    const outside = { path: 'x.jpg', url: 'https://example.com/x.jpg', width: 1, height: 1 };
    expect(
      await attempt(() =>
        writeListing(as(OWNER, piece('mine', { isNew: false, photos: [outside] }))),
      ),
    ).toMatch(/upload/);
  });

  it('refreshes her name on the piece from her profile', async () => {
    await db.doc(`${COLLECTIONS.users}/${OWNER}`).update({ displayName: 'New Name' });
    await writeListing(as(OWNER, piece('mine', { isNew: false })));
    expect((await read('mine'))?.owner.displayName).toBe('New Name');
  });

  it('stops anyone else editing it', async () => {
    expect(
      await attempt(() =>
        writeListing(
          as(
            OTHER,
            piece('mine', { isNew: false, photos: [photo(OTHER, 'mine')], name: 'Mine now' }),
          ),
        ),
      ),
    ).toMatch(/your own pieces/);
    expect((await read('mine'))?.name).toBe('Vintage Silk Slip Dress');
  });

  for (const status of ['sold', 'suspended', 'removed']) {
    it(`refuses editing a ${status} piece (no putting it back up)`, async () => {
      await db.doc(`${COLLECTIONS.listings}/mine`).update({ status });
      expect(await attempt(() => writeListing(as(OWNER, piece('mine', { isNew: false }))))).toMatch(
        /can't be edited/,
      );
      expect((await read('mine'))?.status).toBe(status);
    });
  }

  it('says so when the piece is gone', async () => {
    expect(await attempt(() => writeListing(as(OWNER, piece('nope', { isNew: false }))))).toMatch(
      /no longer on Loane/,
    );
  });
});
