import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  TRENDING,
  rankTrending,
  type Booking,
  type Listing,
  type Save,
  type TrendingDoc,
  type TrendingListingInfo,
  type TrendingSignal,
} from '@loane/shared';
import { onCall } from '../lib/callable';
import { db, now, Timestamp } from '../lib/admin';
import { requireAdmin } from '../lib/guards';

/**
 * "Trending on campus this week" — NORTH_STAR D5.
 *
 * Every hour, for every campus: read the last seven days of saves,
 * rent/buy requests and tag taps, score each piece with `rankTrending`
 * (shared/src/trending.ts — once per person, owner excluded, at least two
 * different students) and write the top ten to `trending/{campusId}`.
 *
 * Hourly, not live, because "this week" barely moves in an hour and a
 * live count would mean a write to a shared document on every save.
 *
 * Reads are capped (`TRENDING.readCap` newest rows per signal per
 * campus). At launch a week is a few hundred rows; if a campus ever hits
 * the cap, the oldest days of the week simply stop counting, and the log
 * line says so.
 */

export interface TrendingRunResult {
  campuses: number;
  trending: number;
}

export async function refreshTrendingForCampus(
  campusId: string,
  nowMs: number = Date.now(),
): Promise<Omit<TrendingDoc, 'computedAt'>> {
  const since = Timestamp.fromMillis(nowMs - TRENDING.windowDays * 24 * 3_600_000);
  const cap = TRENDING.readCap;

  const [saves, bookings, taps] = await Promise.all([
    db()
      .collection(COLLECTIONS.saves)
      .where('campusId', '==', campusId)
      .where('createdAt', '>=', since)
      .orderBy('createdAt', 'desc')
      .limit(cap)
      .get(),
    db()
      .collection(COLLECTIONS.bookings)
      .where('campusId', '==', campusId)
      .where('createdAt', '>=', since)
      .orderBy('createdAt', 'desc')
      .limit(cap)
      .get(),
    db()
      .collection(COLLECTIONS.events)
      .where('campusId', '==', campusId)
      .where('type', '==', 'tagged_item_tap')
      .where('createdAt', '>=', since)
      .orderBy('createdAt', 'desc')
      .limit(cap)
      .get(),
  ]);

  const signals: TrendingSignal[] = [];
  for (const doc of saves.docs) {
    const s = doc.data() as Save;
    signals.push({ kind: 'save', uid: s.uid, listingId: s.listingId });
  }
  for (const doc of bookings.docs) {
    const b = doc.data() as Booking;
    signals.push({ kind: 'request', uid: b.renterUid, listingId: b.listingId });
  }
  for (const doc of taps.docs) {
    const e = doc.data() as { uid?: string | null; targetType?: string; targetId?: string | null };
    if (e.targetType !== 'listing' || !e.uid || !e.targetId) continue;
    signals.push({ kind: 'tap', uid: e.uid, listingId: e.targetId });
  }

  for (const [name, snap] of [
    ['saves', saves],
    ['bookings', bookings],
    ['taps', taps],
  ] as const) {
    if (snap.size >= cap) logger.warn('Trending read cap reached', { campusId, signal: name, cap });
  }

  const listings = await loadListings([...new Set(signals.map((s) => s.listingId))]);
  // A piece on another campus can't trend here, however it got in.
  for (const [id, info] of listings) {
    if (info.campusId !== campusId) listings.delete(id);
  }

  const result: Omit<TrendingDoc, 'computedAt'> = {
    campusId,
    items: rankTrending(signals, listings),
    windowDays: TRENDING.windowDays,
  };
  await db()
    .collection(COLLECTIONS.trending)
    .doc(campusId)
    .set({ ...result, computedAt: now() });
  return result;
}

async function loadListings(
  ids: string[],
): Promise<Map<string, TrendingListingInfo & { campusId: string }>> {
  const out = new Map<string, TrendingListingInfo & { campusId: string }>();
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((id) => db().collection(COLLECTIONS.listings).doc(id));
    if (refs.length === 0) continue;
    const snaps = await db().getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const l = snap.data() as Listing;
      out.set(snap.id, {
        id: snap.id,
        ownerUid: l.ownerUid,
        status: l.status,
        campusId: l.campusId,
      });
    }
  }
  return out;
}

export async function refreshAllTrending(nowMs: number = Date.now()): Promise<TrendingRunResult> {
  const campuses = await db().collection(COLLECTIONS.campuses).get();
  let trending = 0;
  for (const campus of campuses.docs) {
    try {
      const doc = await refreshTrendingForCampus(campus.id, nowMs);
      trending += doc.items.length;
    } catch (err) {
      // One campus failing must not stop the others.
      logger.error('Trending refresh failed', { campusId: campus.id, err: String(err) });
    }
  }
  logger.info('Trending refreshed', { campuses: campuses.size, trending });
  return { campuses: campuses.size, trending };
}

export const refreshTrending = onSchedule(
  { schedule: 'every 60 minutes', region: 'us-central1' },
  async () => {
    await refreshAllTrending();
  },
);

/**
 * The same refresh, callable by an admin — the emulator never fires a
 * scheduled function, so this is how the seed and tests run it.
 */
export const runTrendingRefresh = onCall<Record<string, never>, Promise<TrendingRunResult>>(
  { region: 'us-central1' },
  async (request) => {
    requireAdmin(request);
    return refreshAllTrending();
  },
);
