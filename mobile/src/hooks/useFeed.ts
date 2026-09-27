/**
 * Reads posts and listings for the signed-in student's campus.
 *
 * Both queries are scoped to her campusId — that is what keeps a USC
 * student's feed full of USC closets — and to active status, so removed or
 * suspended content never renders.
 */

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Listing, type Post } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

const PAGE_SIZE = 30;

interface Result<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}

function useCampusCollection<T>(collectionName: string, campusField: string): Result<T> {
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
      limit(PAGE_SIZE),
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
  }, [campusId, collectionName, campusField]);

  return { items, loading, error };
}

export function usePosts(): Result<Post> {
  return useCampusCollection<Post>(COLLECTIONS.posts, 'campusId');
}

export function useListings(): Result<Listing> {
  return useCampusCollection<Listing>(COLLECTIONS.listings, 'campusId');
}
