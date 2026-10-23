/**
 * Who liked a look.
 *
 * A like row holds only a uid, so the profiles are read separately,
 * thirty at a time — the most an `in` query takes. Read on demand: this
 * only runs when somebody opens the list, which is rare compared with
 * scrolling past the "Liked by ..." line that leads to it.
 *
 * Newest first, matching the name shown on the post — she taps "Liked by
 * Harper" and Harper is at the top.
 *
 * A page at a time, by cursor: unlike comments this is a one-off read,
 * not a live listener, so there is no window to grow — each page picks up
 * after the last like row it read. That also means a pull to refresh
 * really does read it again (see `refresh`).
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
import { COLLECTIONS, PAGE_SIZES, isLastPage, type Like, type UserSummary } from '@loane/shared';
import { db } from '../firebase/config';
import { readUsers } from './useFollowing';

type Cursor = QueryDocumentSnapshot | null;

/** One page of likers after `after`, in like order, active accounts only. */
async function readPage(postId: string, after: Cursor) {
  const likes = await getDocs(
    query(
      collection(db, COLLECTIONS.likes),
      where('postId', '==', postId),
      orderBy('createdAt', 'desc'),
      ...(after ? [startAfter(after)] : []),
      limit(PAGE_SIZES.people),
    ),
  );
  const uids = likes.docs.map((d) => (d.data() as Like).uid);
  const found = new Map((await readUsers(uids)).map((u) => [u.uid, u]));
  return {
    // Keep the order the likes came back in.
    people: uids.map((uid) => found.get(uid)).filter((p): p is UserSummary => Boolean(p)),
    cursor: likes.docs[likes.docs.length - 1] ?? after,
    hasMore: !isLastPage(likes.docs.length, PAGE_SIZES.people),
  };
}

export function usePostLikers(postId: string | undefined) {
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const cursor = useRef<Cursor>(null);
  /** Bumped on every fresh start, so a slow old read cannot land late. */
  const generation = useRef(0);

  const start = useCallback(
    async (mode: 'first' | 'refresh') => {
      if (!postId) {
        setLoading(false);
        return;
      }
      const mine = ++generation.current;
      if (mode === 'first') setLoading(true);
      else setRefreshing(true);
      try {
        const page = await readPage(postId, null);
        if (mine !== generation.current) return;
        cursor.current = page.cursor;
        setPeople(page.people);
        setHasMore(page.hasMore);
        setError(false);
      } catch {
        if (mine !== generation.current) return;
        // A failed refresh keeps the list she already has; only a failed
        // first read has nothing to show but "Try again".
        if (mode === 'first') setError(true);
      } finally {
        if (mine === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [postId],
  );

  useEffect(() => {
    void start('first');
    return () => {
      generation.current++;
    };
  }, [start]);

  const loadMore = useCallback(() => {
    if (!postId || !hasMore || loadingMore || loading || refreshing) return;
    const mine = generation.current;
    setLoadingMore(true);
    void readPage(postId, cursor.current)
      .then((page) => {
        if (mine !== generation.current) return;
        cursor.current = page.cursor;
        setPeople((prev) => {
          const seen = new Set(prev.map((p) => p.uid));
          return [...prev, ...page.people.filter((p) => !seen.has(p.uid))];
        });
        setHasMore(page.hasMore);
      })
      // A failed next page stops paging quietly; she still has the list
      // and a pull starts it over.
      .catch(() => {
        if (mine === generation.current) setHasMore(false);
      })
      .finally(() => {
        if (mine === generation.current) setLoadingMore(false);
      });
  }, [postId, hasMore, loadingMore, loading, refreshing]);

  const retry = useCallback(() => void start('first'), [start]);
  const refresh = useCallback(() => void start('refresh'), [start]);

  return { people, loading, error, retry, refresh, refreshing, hasMore, loadMore, loadingMore };
}
