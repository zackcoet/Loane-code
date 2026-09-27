/**
 * Reviews about one student.
 */

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Review } from '@loane/shared';
import { db } from '../firebase/config';

export function useReviews(subjectUid: string | undefined) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.reviews),
        where('subjectUid', '==', subjectUid),
        where('isHidden', '==', false),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
      (snap) => {
        setReviews(snap.docs.map((d) => ({ ...(d.data() as Review), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [subjectUid]);

  return { reviews, loading };
}
