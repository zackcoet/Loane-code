/**
 * Saving a listing to the wishlist.
 *
 * The save edge id is `{uid}_{listingId}`, so "have I saved this?" is one
 * cheap point read rather than a query. Writing goes through a Cloud
 * Function because saves drive a counter on the listing.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { COLLECTIONS, ids, type Listing, type Save } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { saveListing, unsaveListing } from '../firebase/callables';
import { logEvent } from '../analytics/events';

export function useIsSaved(listingId: string | undefined) {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !listingId) {
      setSaved(false);
      return;
    }
    return onSnapshot(
      doc(db, COLLECTIONS.saves, ids.save(uid, listingId)),
      (snap) => setSaved(snap.exists()),
      () => setSaved(false),
    );
  }, [uid, listingId]);

  const toggle = useCallback(
    async (surface: 'listing' | 'discover' | 'closet' = 'listing') => {
      if (!listingId || busy) return;
      setBusy(true);
      // Flip straight away — waiting on the round trip makes the heart feel
      // broken. The snapshot corrects it if the call fails.
      const next = !saved;
      setSaved(next);
      try {
        if (next) {
          await saveListing({ listingId });
          logEvent('save', { surface, targetType: 'listing', targetId: listingId });
        } else {
          await unsaveListing({ listingId });
          logEvent('unsave', { surface, targetType: 'listing', targetId: listingId });
        }
      } catch {
        setSaved(!next);
      } finally {
        setBusy(false);
      }
    },
    [listingId, saved, busy],
  );

  return { saved, toggle, busy };
}

/**
 * Everything she has saved, newest first.
 *
 * Two steps: read her save rows, then read those listings. Firestore has
 * no joins, and a listing can change after she saved it, so we always read
 * the live listing rather than caching a copy on the save row.
 */
export function useWishlist() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);

    return onSnapshot(
      query(
        collection(db, COLLECTIONS.saves),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(60),
      ),
      (snap) => {
        const ids = snap.docs.map((d) => (d.data() as Save).listingId);
        if (ids.length === 0) {
          setListings([]);
          setLoading(false);
          return;
        }

        // `in` takes at most 30 values, so read in chunks and keep her
        // original save order.
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

        Promise.all(
          chunks.map(
            (chunk) =>
              new Promise<Listing[]>((resolve) => {
                const unsub = onSnapshot(
                  query(collection(db, COLLECTIONS.listings), where('id', 'in', chunk)),
                  (listingSnap) => {
                    resolve(listingSnap.docs.map((d) => ({ ...(d.data() as Listing), id: d.id })));
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
          const byId = new Map(groups.flat().map((l) => [l.id, l]));
          setListings(ids.map((id) => byId.get(id)).filter((l): l is Listing => Boolean(l)));
          setLoading(false);
        });
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { listings, loading };
}
