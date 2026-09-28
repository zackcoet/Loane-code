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
 */

import { useEffect, useState } from 'react';
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { COLLECTIONS, type Like, type User, type UserSummary } from '@loane/shared';
import { db } from '../firebase/config';

export function usePostLikers(postId: string | undefined) {
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);

    void (async () => {
      try {
        const likes = await getDocs(
          query(
            collection(db, COLLECTIONS.likes),
            where('postId', '==', postId),
            orderBy('createdAt', 'desc'),
            limit(200),
          ),
        );
        const uids = likes.docs.map((d) => (d.data() as Like).uid);
        const found = new Map<string, UserSummary>();

        for (let i = 0; i < uids.length; i += 30) {
          const chunk = uids.slice(i, i + 30);
          if (chunk.length === 0) continue;
          const snap = await getDocs(
            query(collection(db, COLLECTIONS.users), where(documentId(), 'in', chunk)),
          );
          for (const d of snap.docs) {
            const user = d.data() as User;
            if (user.status !== 'active') continue;
            found.set(user.uid, {
              uid: user.uid,
              username: user.username,
              displayName: user.displayName,
              photoUrl: user.photoUrl,
              campusId: user.campusId,
              isVerified: user.isVerified,
            });
          }
        }

        if (!live) return;
        // Keep the order the likes came back in.
        setPeople(uids.map((uid) => found.get(uid)).filter((p): p is UserSummary => Boolean(p)));
      } catch {
        if (live) setPeople([]);
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [postId]);

  return { people, loading };
}
