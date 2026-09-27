/**
 * The feed, a page at a time.
 *
 * A feed is scrolled, so it loads twenty posts and fetches the next
 * twenty when she nears the bottom. That keeps the first paint fast no
 * matter how busy the campus gets.
 *
 * ON THE FOLLOWING TAB. It filters the pages already loaded rather than
 * querying by author. Firestore's `in` takes at most thirty values, so a
 * query would break for anyone following more than thirty closets, and
 * the real fix is a fan-out feed — a Cloud Function writing each new post
 * into its followers' own feed collections. That is the right answer at
 * scale and the wrong amount of machinery for a campus with a few hundred
 * posts. Noted in docs/roadmap.md.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { COLLECTIONS, type Post } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

const PAGE_SIZE = 20;

export function usePagedPosts() {
  const { profile } = useAuth();
  const campusId = profile?.campusId ?? null;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  // Guards against onEndReached firing twice before the first page lands.
  const inFlight = useRef(false);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!campusId || inFlight.current) return;
      inFlight.current = true;

      if (reset) {
        cursor.current = null;
        setExhausted(false);
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const base = [
          where('campusId', '==', campusId),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
        ];
        const snap = await getDocs(
          query(
            collection(db, COLLECTIONS.posts),
            ...base,
            ...(cursor.current && !reset ? [startAfter(cursor.current)] : []),
            limit(PAGE_SIZE),
          ),
        );

        const page = snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
        cursor.current = snap.docs[snap.docs.length - 1] ?? cursor.current;
        if (snap.docs.length < PAGE_SIZE) setExhausted(true);

        setPosts((current) => {
          if (reset) return page;
          // Belt and braces: never show the same post twice if a page
          // boundary shifts under us.
          const seen = new Set(current.map((p) => p.id));
          return [...current, ...page.filter((p) => !seen.has(p.id))];
        });
        setError(null);
      } catch {
        setError('Could not load the feed. Pull to refresh.');
      } finally {
        inFlight.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [campusId],
  );

  useEffect(() => {
    void fetchPage(true);
  }, [fetchPage]);

  return {
    posts,
    loading,
    loadingMore,
    error,
    exhausted,
    refresh: () => fetchPage(true),
    loadMore: () => {
      if (!exhausted && !loading && !loadingMore) void fetchPage(false);
    },
  };
}
