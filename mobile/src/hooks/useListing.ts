/**
 * Reading one listing, live.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS, type Listing } from '@loane/shared';
import { db } from '../firebase/config';

export function useListing(listingId: string | undefined) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setNotFound(false);

    return onSnapshot(
      doc(db, COLLECTIONS.listings, listingId),
      (snap) => {
        if (!snap.exists()) setNotFound(true);
        else setListing({ ...(snap.data() as Listing), id: snap.id });
        setLoading(false);
      },
      () => {
        setNotFound(true);
        setLoading(false);
      },
    );
  }, [listingId]);

  return { listing, loading, notFound };
}
