/**
 * Looks she has liked.
 *
 * Reads her like edges, then the posts behind them. Same shape as the
 * saved-posts reader: the post is read live rather than copied onto the
 * like, so one that has since been taken down does not linger.
 */

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Like, type Post } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useLikedPosts() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);

    return onSnapshot(
      query(
        collection(db, COLLECTIONS.likes),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(60),
      ),
      (snap) => {
        const ids = snap.docs.map((d) => (d.data() as Like).postId);
        if (ids.length === 0) {
          setPosts([]);
          setLoading(false);
          return;
        }

        // `in` takes at most 30 values, so read in chunks and keep her
        // original order.
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

        Promise.all(
          chunks.map(
            (chunk) =>
              new Promise<Post[]>((resolve) => {
                const unsub = onSnapshot(
                  query(collection(db, COLLECTIONS.posts), where('id', 'in', chunk)),
                  (s) => {
                    resolve(s.docs.map((d) => ({ ...(d.data() as Post), id: d.id })));
                    unsub();
                  },
                  () => {
                    resolve([]);
                    unsub();
                  },
                );
              }),
          ),
        ).then((groups) => {
          const byId = new Map(groups.flat().map((p) => [p.id, p]));
          setPosts(
            ids
              .map((id) => byId.get(id))
              .filter((p): p is Post => Boolean(p) && p!.status === 'active'),
          );
          setLoading(false);
        });
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { posts, loading };
}
