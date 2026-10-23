/**
 * Looks she has liked.
 *
 * Her like edges are live, so liking something and opening this finds
 * it already there. The posts behind them are read once per change: a
 * post is only in this list because of the edge, and the edge listener
 * is what tells us the list moved.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, withoutBlocked, type Like, type Post } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { readPostsInOrder } from './readPostsInOrder';
import { useHiddenUids } from './useBlocks';
import { useRetry } from './useRetry';
import { isCachedEmpty } from '../network/connection';

export function useLikedPosts() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
    if (!uid) {
      setPosts([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);

    const unsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.likes),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(60),
      ),
      (snap) => {
        // No signal and nothing cached: an empty answer here is a guess,
        // not "no liked looks yet". Say it could not load (shared/connection.ts).
        if (isCachedEmpty(snap)) {
          if (!live) return;
          setFailed(true);
          setLoading(false);
          return;
        }
        const ids = snap.docs.map((d) => (d.data() as Like).postId);
        if (ids.length === 0) {
          if (live) {
            setPosts([]);
            setLoading(false);
          }
          return;
        }
        void readPostsInOrder(ids)
          .then((found) => {
            if (!live) return;
            setPosts(found);
            setLoading(false);
          })
          .catch(() => {
            if (!live) return;
            setFailed(true);
            setLoading(false);
          });
      },
      () => {
        if (!live) return;
        setFailed(true);
        setLoading(false);
      },
    );

    return () => {
      // Stops a read that is still in flight from setting state after
      // she has navigated away.
      live = false;
      unsubscribe();
    };
  }, [uid, attempt]);

  // Looks by someone blocked either way drop out, like everywhere else.
  const hidden = useHiddenUids();
  const visible = useMemo(() => withoutBlocked(posts, (p) => p.authorUid, hidden), [posts, hidden]);

  return { posts: visible, loading, failed, retry };
}
