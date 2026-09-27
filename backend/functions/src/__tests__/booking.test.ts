/**
 * Double-booking tests.
 *
 * This is the failure that would most damage trust: a girl showing up for a
 * gameday dress that someone else already has. The guarantee is that
 * `requestBooking` runs its conflict check inside a Firestore transaction,
 * so concurrent requests cannot both win.
 *
 * These tests fire many simultaneous requests at one dress and assert that
 * exactly one succeeds.
 *
 * Run the emulators first:  npm run emulators
 */

import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BLOCKING_BOOKING_STATUSES,
  COLLECTIONS,
  rangeHitsBlackout,
  rangesOverlap,
} from '@loane/shared';

const PROJECT = 'demo-loane-bookings';
const LISTING = 'listing-gameday-dress';

let app: App;
let db: Firestore;

/**
 * The same conflict check `requestBooking` performs, run inside a
 * transaction. Kept in step with the function by using the identical
 * shared helpers (`rangesOverlap`, `BLOCKING_BOOKING_STATUSES`).
 */
async function attemptBooking(
  renterUid: string,
  startDate: string,
  endDate: string,
): Promise<'booked' | 'conflict'> {
  const listingRef = db.collection(COLLECTIONS.listings).doc(LISTING);
  const bookingRef = db.collection(COLLECTIONS.bookings).doc();

  try {
    return await db.runTransaction(async (tx) => {
      const listingSnap = await tx.get(listingRef);
      const listing = listingSnap.data() as { blackoutDates?: string[] };

      const existing = await tx.get(
        db
          .collection(COLLECTIONS.bookings)
          .where('listingId', '==', LISTING)
          .where('status', 'in', BLOCKING_BOOKING_STATUSES as string[]),
      );

      const clash = existing.docs.some((doc) => {
        const b = doc.data() as { startDate: string; endDate: string };
        return rangesOverlap({ startDate, endDate }, b);
      });
      if (clash) return 'conflict' as const;

      if (rangeHitsBlackout({ startDate, endDate }, listing.blackoutDates ?? [])) {
        return 'conflict' as const;
      }

      tx.set(bookingRef, {
        id: bookingRef.id,
        listingId: LISTING,
        renterUid,
        // Confirmed, so it blocks the calendar for everyone behind it.
        status: 'confirmed',
        startDate,
        endDate,
      });
      return 'booked' as const;
    });
  } catch {
    // A transaction that exhausted its retries is a conflict too.
    return 'conflict';
  }
}

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  app = initializeApp({ projectId: PROJECT }, 'booking-tests');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  const bookings = await db.collection(COLLECTIONS.bookings).get();
  await Promise.all(bookings.docs.map((d) => d.ref.delete()));

  await db.collection(COLLECTIONS.listings).doc(LISTING).set({
    id: LISTING,
    status: 'active',
    intent: 'rent',
    blackoutDates: [],
  });
});

describe('double-booking', () => {
  it('lets exactly one of ten simultaneous requests win the same weekend', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        attemptBooking(`renter-${i}`, '2026-10-09', '2026-10-12'),
      ),
    );

    expect(results.filter((r) => r === 'booked')).toHaveLength(1);
    expect(results.filter((r) => r === 'conflict')).toHaveLength(9);

    const stored = await db.collection(COLLECTIONS.bookings).get();
    expect(stored.size).toBe(1);
  });

  it('rejects a request that overlaps an existing confirmed booking', async () => {
    expect(await attemptBooking('renter-a', '2026-10-09', '2026-10-12')).toBe('booked');
    // Starts inside the existing window.
    expect(await attemptBooking('renter-b', '2026-10-11', '2026-10-14')).toBe('conflict');
    // Ends inside it.
    expect(await attemptBooking('renter-c', '2026-10-07', '2026-10-10')).toBe('conflict');
    // Completely contains it.
    expect(await attemptBooking('renter-d', '2026-10-08', '2026-10-15')).toBe('conflict');
  });

  it('allows a back-to-back booking starting the day the last one ends', async () => {
    // Half-open ranges: she returns it the morning of the 12th, the next
    // girl takes it that afternoon. These must not collide.
    expect(await attemptBooking('renter-a', '2026-10-09', '2026-10-12')).toBe('booked');
    expect(await attemptBooking('renter-b', '2026-10-12', '2026-10-15')).toBe('booked');

    const stored = await db.collection(COLLECTIONS.bookings).get();
    expect(stored.size).toBe(2);
  });

  it('allows a non-overlapping weekend', async () => {
    expect(await attemptBooking('renter-a', '2026-10-09', '2026-10-12')).toBe('booked');
    expect(await attemptBooking('renter-b', '2026-10-16', '2026-10-19')).toBe('booked');
  });

  it('respects the owner’s blackout dates', async () => {
    await db
      .collection(COLLECTIONS.listings)
      .doc(LISTING)
      .update({ blackoutDates: ['2026-10-10'] });

    expect(await attemptBooking('renter-a', '2026-10-09', '2026-10-12')).toBe('conflict');
    expect(await attemptBooking('renter-b', '2026-10-16', '2026-10-19')).toBe('booked');
  });

  it('does not let a merely requested booking block the calendar', async () => {
    // A lender should be able to receive several requests for one weekend
    // and choose between them.
    await db.collection(COLLECTIONS.bookings).add({
      listingId: LISTING,
      renterUid: 'renter-a',
      status: 'requested',
      startDate: '2026-10-09',
      endDate: '2026-10-12',
    });

    expect(await attemptBooking('renter-b', '2026-10-09', '2026-10-12')).toBe('booked');
  });
});
