/**
 * Looks she has liked.
 *
 * Her like edges are live, so liking something and opening this finds
 * it already there. The posts behind them are read once per change: a
 * post is only in this list because of the edge, and the edge listener
 * is what tells us the list moved.
 */

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Like, type Post } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { readPostsInOrder } from './readPostsInOrder';

export function useLikedPosts() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
            if (live) setLoading(false);
          });
      },
      () => {
        if (live) setLoading(false);
      },
    );

    return () => {
      // Stops a read that is still in flight from setting state after
      // she has navigated away.
      live = false;
      unsubscribe();
    };
  }, [uid]);

  return { posts, loading };
}
