/**
 * Posts that tag a given listing — the "Seen in posts" strip.
 *
 * This is the whole reason `taggedListingIds` exists as a flat array:
 * Firestore's `array-contains` only works on plain values, so a list of
 * tag objects could never answer this question.
 */

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Post } from '@loane/shared';
import { db } from '../firebase/config';

export function usePostsTagging(listingId: string | undefined) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.posts),
        where('status', '==', 'active'),
        where('taggedListingIds', 'array-contains', listingId),
        orderBy('createdAt', 'desc'),
        limit(12),
      ),
      (snap) => {
        setPosts(snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [listingId]);

  return { posts, loading };
}
