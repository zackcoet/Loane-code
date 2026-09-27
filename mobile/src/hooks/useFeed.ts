/**
 * Reads posts and listings for the signed-in student's campus.
 *
 * Both queries are scoped to her campusId — that is what keeps a USC
 * student's feed full of USC closets — and to active status, so removed or
 * suspended content never renders.
 */

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  COLLECTIONS,
  type Listing,
  type Post,
} from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

/**
 * Posts load a page at a time — a feed is scrolled, so there is no reason
 * to fetch a hundred at once.
 */
const POST_PAGE_SIZE = 20;

/**
 * Listings load in one go, because Discover searches and filters ON THE
 * PHONE. If we only fetched thirty, searching would only ever search
 * those thirty, and a filter would silently miss most of the campus.
 *
 * The cap is a safety net, not a target. It sits below the ~1,500
 * listings-per-campus point at which we move to a real search service, so
 * the two numbers agree — see docs/roadmap.md. If a campus ever hits this
 * ceiling the fix is that migration, not a bigger number.
 */
const LISTING_LIMIT = 1000;

interface Result<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}

function useCampusCollection<T>(
  collectionName: string,
  campusField: string,
  pageSize: number,
): Result<T> {
  const { profile } = useAuth();
  const campusId = profile?.campusId ?? null;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campusId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, collectionName),
      where(campusField, '==', campusId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    );

    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })));
        setLoading(false);
      },
      () => {
        setError('Could not load right now. Pull to refresh.');
        setLoading(false);
      },
    );
  }, [campusId, collectionName, campusField, pageSize]);

  return { items, loading, error };
}

export function usePosts(): Result<Post> {
  return useCampusCollection<Post>(COLLECTIONS.posts, 'campusId', POST_PAGE_SIZE);
}

/** Every active listing on her campus, so on-device search sees them all. */
export function useListings(): Result<Listing> {
  return useCampusCollection<Listing>(COLLECTIONS.listings, 'campusId', LISTING_LIMIT);
}
