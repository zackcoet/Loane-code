/**
 * The week's trending pieces on her campus — `trending/{campusId}`,
 * worked out hourly by the `refreshTrending` Cloud Function.
 *
 * Returns ids only. Discover already holds every active piece on her
 * campus (minus blocked closets), so it looks them up there: a sold
 * piece or a blocked girl's piece simply isn't found and drops out.
 *
 * If the read fails the row just doesn't show — trending is a bonus on
 * top of Discover, never a reason to show her an error.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS, type TrendingDoc } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useTrendingIds(): string[] {
  const { profile } = useAuth();
  const campusId = profile?.campusId ?? null;
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (!campusId) {
      setIds([]);
      return;
    }
    return onSnapshot(
      doc(db, COLLECTIONS.trending, campusId),
      (snap) => {
        const data = snap.exists() ? (snap.data() as TrendingDoc) : null;
        setIds(data?.items.map((item) => item.listingId) ?? []);
      },
      () => setIds([]),
    );
  }, [campusId]);

  return ids;
}
