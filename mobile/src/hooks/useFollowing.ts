/**
 * The set of uids the signed-in student follows.
 *
 * Used by Discover's Following tab. A Set rather than a list because the
 * only question ever asked is "is this owner one of them?".
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Follow } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useFollowingUids() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [uids, setUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setUids(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, COLLECTIONS.follows), where('followerUid', '==', uid)),
      (snap) => {
        setUids(new Set(snap.docs.map((d) => (d.data() as Follow).followingUid)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { uids, loading };
}
