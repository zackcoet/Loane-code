/**
 * The steps after a yes — against the emulator.
 *
 *   - Own It: a request has the full booking shape, junk is refused, and
 *     a piece late back with a renter cannot be asked for.
 *   - Drop-off: only the lender, only once confirmed; a sale without a
 *     note no longer fails.
 *   - "I have it": a rental goes to her; a SALE ends there and the piece
 *     is marked sold.
 *   - Return: the renter starts the window, the lender ends it; nothing
 *     comes back on a sale.
 *   - Problem: lender only, inside the window, never on a sale.
 *   - Cancel: a reason is needed, a stranger can't, and not once she
 *     has it.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, addDays, toIsoDate } from '@loane/shared';

const PROJECT = 'demo-loane';
const BUCKET = 'demo-loane.firebasestorage.app';
const CAMPUS = 'university-of-south-carolina';
const ELLA = 'uid-ella-steps'; // the lender / seller
const HARPER = 'uid-harper-steps'; // the renter / buyer
const STRANGER = 'uid-stranger-steps';
const LISTING = 'listing-steps-dress';
const TODAY = toIsoDate(new Date());

type Fn = (req: CallableRequest<unknown>) => Promise<unknown>;
let app: App;
let db: Firestore;
let fns: Record<
  | 'requestPurchase'
  | 'recordDropoff'
  | 'confirmReceipt'
  | 'confirmReturn'
  | 'flagReturnProblem'
  | 'cancelBooking',
  Fn
>;

const saved = { ...process.env };

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

function photo(uid: string, bookingId: string, name = 'p.jpg') {
  const path = `users/${uid}/bookings/${bookingId}/${name}`;
  return {
    path,
    url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=t`,
    width: 800,
    height: 1000,
  };
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
    stats: {},
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

/** A booking in any state, in the full shape requestBooking writes. */
async function booking(
  id: string,
  kind: 'rental' | 'purchase',
  status: string,
  extra: Record<string, unknown> = {},
) {
  await db.doc(`${COLLECTIONS.bookings}/${id}`).set({
    id,
    kind,
    status,
    listingId: LISTING,
    campusId: CAMPUS,
    lenderUid: ELLA,
    renterUid: HARPER,
    lender: summary(ELLA, 'ellasteps'),
    renter: summary(HARPER, 'harpersteps'),
    listing: { listingId: LISTING, name: 'Red mini dress' },
    startDate: kind === 'rental' ? addDays(TODAY, 2) : null,
    endDate: kind === 'rental' ? addDays(TODAY, 5) : null,
    handoff: {
      notes: null,
      dropoffPhotos: [],
      dropoffAt: null,
      renterConfirmedReceiptAt: null,
      returnPhotos: [],
      renterConfirmedReturnAt: null,
      lenderConfirmedReturnAt: null,
    },
    timeline: {},
    reviews: { lenderReviewId: null, renterReviewId: null },
    disputeWindowEndsAt: null,
    ...extra,
  });
}

const read = async (path: string) => (await db.doc(path).get()).data()!;
const bookingDoc = (id: string) => read(`${COLLECTIONS.bookings}/${id}`);

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = PROJECT;
  // Photo links are checked against the real bucket's address.
  delete process.env.FUNCTIONS_EMULATOR;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  delete process.env.STORAGE_BUCKET;
  app = initializeApp({ projectId: PROJECT });
  db = getFirestore(app);
  const lifecycle = await import('../bookings/lifecycle');
  const purchase = await import('../bookings/requestPurchase');
  fns = {
    requestPurchase: (r) => purchase.requestPurchase.run(r as never),
    recordDropoff: (r) => lifecycle.recordDropoff.run(r as never),
    confirmReceipt: (r) => lifecycle.confirmReceipt.run(r as never),
    confirmReturn: (r) => lifecycle.confirmReturn.run(r as never),
    flagReturnProblem: (r) => lifecycle.flagReturnProblem.run(r as never),
    cancelBooking: (r) => lifecycle.cancelBooking.run(r as never),
  };
});

afterAll(async () => {
  await deleteApp(app);
  process.env = saved;
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
  for (const [uid, name] of [
    [ELLA, 'ellasteps'],
    [HARPER, 'harpersteps'],
    [STRANGER, 'strangersteps'],
  ] as const) {
    await db.doc(`${COLLECTIONS.users}/${uid}`).set(student(uid, name));
    await db
      .doc(`${COLLECTIONS.users}/${uid}/private/settings`)
      .set({ uid, phone: '+18035550100' });
  }
  await db.doc(`${COLLECTIONS.listings}/${LISTING}`).set({
    id: LISTING,
    ownerUid: ELLA,
    owner: summary(ELLA, 'ellasteps'),
    campusId: CAMPUS,
    name: 'Red mini dress',
    coverUrl: null,
    status: 'active',
    intent: 'both',
    pricing: { oneDayCents: 1500, threeDayCents: 2500 },
    salePriceCents: 4000,
    garmentValueCents: 6000,
    blackoutDates: [],
    stats: {},
  });
});

describe('Own It — asking to buy', () => {
  it('writes a request in the full booking shape, named from her profile', async () => {
    const { bookingId } = (await fns.requestPurchase(
      as(HARPER, { listingId: LISTING, message: ' hi! ' }),
    )) as { bookingId: string };
    const b = await bookingDoc(bookingId);
    expect(b.kind).toBe('purchase');
    expect(b.status).toBe('requested');
    expect(b.handoff.notes).toBeNull();
    expect(b.timeline.respondedAt).toBeNull();
    expect(b.cancelledByUid).toBeNull();
    expect(b.listing.listingId).toBe(LISTING);
    expect(b.lender.username).toBe('ellasteps');
    expect(b.renter.username).toBe('harpersteps');
    expect(b.renterMessage).toBe('hi!');
  });

  it('gives junk a clear answer without using up a request', async () => {
    expect(await attempt(() => fns.requestPurchase(as(HARPER, { listingId: 'a/b' })))).toBe(
      'Pick a piece to buy.',
    );
    expect(await attempt(() => fns.requestPurchase(as(HARPER, { listingId: 7 })))).toBe(
      'Pick a piece to buy.',
    );
    expect(
      await attempt(() => fns.requestPurchase(as(HARPER, { listingId: LISTING, message: 5 }))),
    ).toBe('That note is not text.');
    expect(
      await attempt(() =>
        fns.requestPurchase(as(HARPER, { listingId: LISTING, message: 'x'.repeat(501) })),
      ),
    ).toMatch(/Keep it under/);
    const limits = await db.collection(COLLECTIONS.rateLimits).get();
    expect(limits.size).toBe(0);
  });

  it('refuses a piece a renter still has, even late back', async () => {
    await booking('late', 'rental', 'with_renter', {
      startDate: addDays(TODAY, -5),
      endDate: addDays(TODAY, -1),
    });
    expect(await attempt(() => fns.requestPurchase(as(HARPER, { listingId: LISTING })))).toBe(
      'On Loane right now.',
    );
  });
});

describe('drop-off', () => {
  it('works on a sale with no note (it used to fail)', async () => {
    await booking('s1', 'purchase', 'confirmed');
    // A sale asked for before this fix had no notes field at all.
    await db.doc(`${COLLECTIONS.bookings}/s1`).update({ 'handoff.notes': FieldValue.delete() });
    expect(
      await attempt(() =>
        fns.recordDropoff(as(ELLA, { bookingId: 's1', photos: [photo(ELLA, 's1')] })),
      ),
    ).toBe('ok');
    const b = await bookingDoc('s1');
    expect(b.handoff.dropoffPhotos).toHaveLength(1);
    expect(b.handoff.notes).toBeNull();
  });

  it('is the lender’s, and only once confirmed', async () => {
    await booking('r1', 'rental', 'requested');
    expect(
      await attempt(() =>
        fns.recordDropoff(as(HARPER, { bookingId: 'r1', photos: [photo(HARPER, 'r1')] })),
      ),
    ).toBe('Only the lender records a drop-off.');
    expect(
      await attempt(() =>
        fns.recordDropoff(as(ELLA, { bookingId: 'r1', photos: [photo(ELLA, 'r1')] })),
      ),
    ).toBe('This rental is not confirmed yet.');
    expect(
      await attempt(() =>
        fns.recordDropoff(as(STRANGER, { bookingId: 'r1', photos: [photo(STRANGER, 'r1')] })),
      ),
    ).toBe('That rental is not yours.');
  });

  it('needs a photo', async () => {
    await booking('r1', 'rental', 'confirmed');
    expect(await attempt(() => fns.recordDropoff(as(ELLA, { bookingId: 'r1', photos: [] })))).toBe(
      'Add a photo of the piece before you hand it over.',
    );
  });
});

describe('"I have it"', () => {
  it('hands a rental to her', async () => {
    await booking('r1', 'rental', 'confirmed');
    await db.doc(`${COLLECTIONS.bookings}/r1`).update({
      'handoff.dropoffPhotos': [photo(ELLA, 'r1')],
    });
    await fns.confirmReceipt(as(HARPER, { bookingId: 'r1' }));
    expect((await bookingDoc('r1')).status).toBe('with_renter');
    expect((await read(`${COLLECTIONS.listings}/${LISTING}`)).status).toBe('active');
  });

  it('ends a sale there: completed, the piece sold, both asked for a review', async () => {
    await booking('s1', 'purchase', 'confirmed');
    await db.doc(`${COLLECTIONS.bookings}/s1`).update({
      'handoff.dropoffPhotos': [photo(ELLA, 's1')],
    });
    await fns.confirmReceipt(as(HARPER, { bookingId: 's1' }));
    const b = await bookingDoc('s1');
    expect(b.status).toBe('completed');
    expect(b.handoff.renterConfirmedReceiptAt).not.toBeNull();
    expect((await read(`${COLLECTIONS.listings}/${LISTING}`)).status).toBe('sold');
    for (const uid of [ELLA, HARPER]) {
      const alerts = await db.collection(`${COLLECTIONS.users}/${uid}/notifications`).get();
      expect(alerts.docs.some((d) => d.data().type === 'review_requested')).toBe(true);
    }
  });

  it('a sale on a piece an admin took down keeps it down, remembered as sold', async () => {
    await booking('s1', 'purchase', 'confirmed');
    await db.doc(`${COLLECTIONS.bookings}/s1`).update({
      'handoff.dropoffPhotos': [photo(ELLA, 's1')],
    });
    await db
      .doc(`${COLLECTIONS.listings}/${LISTING}`)
      .update({ status: 'suspended', statusBeforeSuspension: 'active' });
    await fns.confirmReceipt(as(HARPER, { bookingId: 's1' }));
    expect((await bookingDoc('s1')).status).toBe('completed');
    const piece = await read(`${COLLECTIONS.listings}/${LISTING}`);
    expect(piece.status).toBe('suspended');
    expect(piece.statusBeforeSuspension).toBe('sold');
  });

  it('waits for the drop-off photo, and is only the renter’s', async () => {
    await booking('r1', 'rental', 'confirmed');
    expect(await attempt(() => fns.confirmReceipt(as(HARPER, { bookingId: 'r1' })))).toBe(
      'Ask the lender to record the drop-off photo first.',
    );
    expect(await attempt(() => fns.confirmReceipt(as(ELLA, { bookingId: 'r1' })))).toBe(
      "You can't make that change on this rental.",
    );
  });
});

describe('return', () => {
  it('the renter starts the 48 hours; the lender ends it', async () => {
    await booking('r1', 'rental', 'with_renter');
    await fns.confirmReturn(as(HARPER, { bookingId: 'r1' }));
    let b = await bookingDoc('r1');
    expect(b.status).toBe('returned');
    expect(b.disputeWindowEndsAt).not.toBeNull();

    await fns.confirmReturn(as(ELLA, { bookingId: 'r1', photos: [photo(ELLA, 'r1')] }));
    b = await bookingDoc('r1');
    expect(b.status).toBe('completed');
    expect(b.handoff.returnPhotos).toHaveLength(1);
    expect((await read(`${COLLECTIONS.users}/${ELLA}`)).stats.rentalsAsLender).toBe(1);
  });

  it('the renter can’t end it herself', async () => {
    await booking('r1', 'rental', 'returned');
    expect(await attempt(() => fns.confirmReturn(as(HARPER, { bookingId: 'r1' })))).toBe(
      "This rental is returned, so that isn't possible.",
    );
  });

  it('nothing comes back on a sale', async () => {
    await booking('s1', 'purchase', 'confirmed');
    expect(await attempt(() => fns.confirmReturn(as(HARPER, { bookingId: 's1' })))).toBe(
      'Nothing comes back on a sale.',
    );
  });

  it('a sale stuck with her from before can be finished', async () => {
    await booking('s1', 'purchase', 'with_renter');
    await fns.confirmReturn(as(ELLA, { bookingId: 's1' }));
    expect((await bookingDoc('s1')).status).toBe('completed');
    expect((await read(`${COLLECTIONS.listings}/${LISTING}`)).status).toBe('sold');
  });
});

describe('flagging a problem', () => {
  const flag = (uid: string, bookingId: string) =>
    fns.flagReturnProblem(
      as(uid, { bookingId, problem: 'damaged', note: 'torn hem', photos: [photo(uid, bookingId)] }),
    );

  it('the lender can, inside the window', async () => {
    await booking('r1', 'rental', 'returned', {
      disputeWindowEndsAt: Timestamp.fromMillis(Date.now() + 3600_000),
    });
    expect(await attempt(() => flag(ELLA, 'r1'))).toBe('ok');
    const b = await bookingDoc('r1');
    expect(b.status).toBe('disputed');
    expect(b.returnProblem.note).toBe('torn hem');
  });

  it('not after the window, not the renter, never on a sale', async () => {
    await booking('r1', 'rental', 'returned', {
      disputeWindowEndsAt: Timestamp.fromMillis(Date.now() - 1000),
    });
    expect(await attempt(() => flag(ELLA, 'r1'))).toBe(
      'The 48-hour window to flag a problem has passed.',
    );
    await booking('r2', 'rental', 'returned');
    expect(await attempt(() => flag(HARPER, 'r2'))).toBe(
      "You can't make that change on this rental.",
    );
    await booking('s1', 'purchase', 'with_renter');
    expect(await attempt(() => flag(ELLA, 's1'))).toMatch(/^Nothing comes back on a sale/);
  });

  it('needs a real problem and a photo', async () => {
    await booking('r1', 'rental', 'returned');
    expect(
      await attempt(() =>
        fns.flagReturnProblem(
          as(ELLA, { bookingId: 'r1', problem: 'vibes', note: '', photos: [photo(ELLA, 'r1')] }),
        ),
      ),
    ).toBe('Pick what went wrong.');
    expect(
      await attempt(() =>
        fns.flagReturnProblem(
          as(ELLA, { bookingId: 'r1', problem: 'damaged', note: '', photos: [] }),
        ),
      ),
    ).toBe('Add at least one photo showing the problem.');
  });
});

describe('cancelling', () => {
  it('needs a reason, and counts against the one who cancelled', async () => {
    await booking('r1', 'rental', 'confirmed');
    expect(await attempt(() => fns.cancelBooking(as(ELLA, { bookingId: 'r1', reason: ' ' })))).toBe(
      'Say why, so the other person knows.',
    );
    await fns.cancelBooking(as(ELLA, { bookingId: 'r1', reason: 'It got stained' }));
    const b = await bookingDoc('r1');
    expect(b.status).toBe('cancelled');
    expect(b.cancelledByUid).toBe(ELLA);
    expect(b.cancellationReason).toBe('It got stained');
    expect((await read(`${COLLECTIONS.users}/${ELLA}`)).stats.cancellations).toBe(1);
  });

  it('not by a stranger, and not once she has it', async () => {
    await booking('r1', 'rental', 'confirmed');
    expect(
      await attempt(() => fns.cancelBooking(as(STRANGER, { bookingId: 'r1', reason: 'x' }))),
    ).toBe('That rental is not yours.');
    await booking('r2', 'rental', 'with_renter');
    expect(
      await attempt(() => fns.cancelBooking(as(HARPER, { bookingId: 'r2', reason: 'x' }))),
    ).toMatch(/so that isn't possible/);
  });

  it('a sale says "Sale cancelled" to the other side', async () => {
    await booking('s1', 'purchase', 'requested');
    await fns.cancelBooking(as(HARPER, { bookingId: 's1', reason: 'Found another' }));
    const alerts = await db.collection(`${COLLECTIONS.users}/${ELLA}/notifications`).get();
    expect(alerts.docs.map((d) => d.data().title)).toContain('Sale cancelled');
  });
});
