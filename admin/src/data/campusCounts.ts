import {
  COLLECTIONS,
  DASHBOARD_LISTING_STATUSES,
  DASHBOARD_POST_STATUSES,
  type Campus,
} from '@loane/shared';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase/config';

/**
 * Pieces, looks and finished rentals per campus, counted by Firestore.
 *
 * WHY NOT THE CAMPUS DOCUMENT. `campuses/{id}.stats` has listing, post and
 * booking counts, but nothing has ever kept them up to date — they sat at
 * 0 on every campus card. Rather than add three more server counters that
 * every create, delete, take-down and account deletion would have to
 * remember, the dashboard asks Firestore to count. A count costs about
 * one read per thousand documents and is exact, unlike the dashboard's
 * other numbers, which only see the newest 250 of each.
 *
 * The student number still comes from the campus document: that one IS
 * kept by the server, and it is what the welcome screen shows girls.
 */
export interface CampusCounts {
  listings: number;
  posts: number;
  completedBookings: number;
}

export type CampusCountsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; byCampus: Record<string, CampusCounts> };

async function countCampus(campusId: string): Promise<CampusCounts> {
  // index-check: equality and "in" filters only — single-field indexes do it.
  const listings = getCountFromServer(
    query(
      collection(db, COLLECTIONS.listings),
      where('campusId', '==', campusId),
      where('status', 'in', [...DASHBOARD_LISTING_STATUSES]),
    ),
  );
  // index-check: equality and "in" filters only — single-field indexes do it.
  const posts = getCountFromServer(
    query(
      collection(db, COLLECTIONS.posts),
      where('campusId', '==', campusId),
      where('status', 'in', [...DASHBOARD_POST_STATUSES]),
    ),
  );
  // index-check: two equality filters — single-field indexes do it.
  const bookings = getCountFromServer(
    query(
      collection(db, COLLECTIONS.bookings),
      where('campusId', '==', campusId),
      where('status', '==', 'completed'),
    ),
  );
  const [l, p, b] = await Promise.all([listings, posts, bookings]);
  return { listings: l.data().count, posts: p.data().count, completedBookings: b.data().count };
}

export function useCampusCounts(campuses: readonly Campus[]): CampusCountsState {
  const [state, setState] = useState<CampusCountsState>({ status: 'loading' });
  const key = campuses.map((c) => c.id).join(',');

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const ids = key ? key.split(',') : [];
    Promise.all(ids.map(async (id) => [id, await countCampus(id)] as const))
      .then((rows) => {
        if (!cancelled) setState({ status: 'ready', byCampus: Object.fromEntries(rows) });
      })
      .catch((err: unknown) => {
        console.error('Campus counts failed', err);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}
