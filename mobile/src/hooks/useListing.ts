/**
 * Reading one listing, live.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS, docPresence, type Listing } from '@loane/shared';
import { db } from '../firebase/config';
import { useRetry } from './useRetry';

export function useListing(listingId: string | undefined) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
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
        // No signal: an empty cache says "missing", which only the
        // server can know. Offer a retry instead (shared/connection.ts);
        // the listener stays open and fills in when the signal returns.
        if (docPresence(snap.exists(), snap.metadata.fromCache) === 'unknown') {
          setFailed(true);
          setLoading(false);
          return;
        }
        setFailed(false);
        if (!snap.exists()) setNotFound(true);
        else setListing({ ...(snap.data() as Listing), id: snap.id });
        setLoading(false);
      },
      (err) => {
        // A removed or hidden piece is refused by the rules: that really
        // is "not found". Anything else (no signal, a timeout) is worth
        // a retry, and saying "gone" would be wrong.
        if (err.code === 'permission-denied') setNotFound(true);
        else setFailed(true);
        setLoading(false);
      },
    );
  }, [listingId, attempt]);

  return { listing, loading, notFound, failed, retry };
}
