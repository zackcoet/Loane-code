/**
 * The feed, a page at a time — with the first page live.
 *
 * A feed is scrolled, so it loads twenty posts and fetches the next
 * twenty when she nears the bottom. That keeps the first paint fast no
 * matter how busy the campus gets.
 *
 * THE FIRST PAGE IS A LISTENER, NOT A ONE-SHOT READ. This used to be
 * `getDocs` all the way down, which meant liking a post did move the
 * count on the server and she never saw it: the copy on screen was
 * whatever had been fetched when the feed loaded. Every count in the
 * feed — likes, comments, shares — and the "Liked by ..." name come off
 * that document, so the page she is actually looking at has to be live.
 *
 * Older pages stay one-shot. She has scrolled past them, nothing she
 * does up top changes them, and a listener per page is a listener we
 * would keep paying for.
 *
 * ON THE FOLLOWING TAB. It filters the pages already loaded rather than
 * querying by author. Firestore's `in` takes at most thirty values, so a
 * query would break for anyone following more than thirty closets, and
 * the real fix is a fan-out feed — a Cloud Function writing each new post
 * into its followers' own feed collections. That is the right answer at
 * scale and the wrong amount of machinery for a campus with a few hundred
 * posts. Noted in docs/roadmap.md.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
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

  const [livePage, setLivePage] = useState<Post[]>([]);
  const [olderPages, setOlderPages] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  /** The last document of everything loaded, for the next page. */
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  // Guards against onEndReached firing twice before a page lands.
  const inFlight = useRef(false);
  /** A ref, not state, so the live listener never has to re-subscribe. */
  const hasOlder = useRef(false);

  // --- The live first page -------------------------------------------------
  useEffect(() => {
    if (!campusId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.posts),
        where('campusId', '==', campusId),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ),
      (snap) => {
        setLivePage(snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id })));
        // Only move the cursor while nothing older has been loaded yet;
        // once she has paged down, the cursor belongs to the last older
        // page and re-pointing it here would fetch the same posts again.
        if (!hasOlder.current) {
          cursor.current = snap.docs[snap.docs.length - 1] ?? null;
          if (snap.docs.length < PAGE_SIZE) setExhausted(true);
        }
        setError(null);
        setLoading(false);
      },
      () => {
        setError('Could not load the feed. Pull to refresh.');
        setLoading(false);
      },
    );
  }, [campusId]);

  // --- Older pages ---------------------------------------------------------
  const loadMore = useCallback(async () => {
    if (!campusId || inFlight.current || exhausted || loading) return;
    if (!cursor.current) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.posts),
          where('campusId', '==', campusId),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
          startAfter(cursor.current),
          limit(PAGE_SIZE),
        ),
      );
      cursor.current = snap.docs[snap.docs.length - 1] ?? cursor.current;
      if (snap.docs.length < PAGE_SIZE) setExhausted(true);
      const page = snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
      if (page.length > 0) hasOlder.current = true;
      setOlderPages((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...page.filter((p) => !seen.has(p.id))];
      });
    } catch {
      setError('Could not load more. Pull to refresh.');
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [campusId, exhausted, loading]);

  const refresh = useCallback(() => {
    // The live page refreshes itself; this just drops everything below it.
    setOlderPages([]);
    hasOlder.current = false;
    setExhausted(false);
    setError(null);
  }, []);

  const posts = useMemo(() => {
    const seen = new Set(livePage.map((p) => p.id));
    return [...livePage, ...olderPages.filter((p) => !seen.has(p.id))];
  }, [livePage, olderPages]);

  return {
    posts,
    loading,
    loadingMore,
    error,
    exhausted,
    refresh,
    loadMore: () => void loadMore(),
  };
}
