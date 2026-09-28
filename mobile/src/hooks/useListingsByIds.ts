/**
 * The live listings behind a post's tags.
 *
 * Read on demand rather than stored on the post. A post already carries
 * a snapshot of each tagged piece's name and price so the dots on the
 * photo render instantly — but the expanded panel shows size, the full
 * price and the description, and those are exactly the things an owner
 * edits. Reading them live means the panel is never quietly wrong, and
 * it costs nothing until somebody actually opens it.
 */

import { useEffect, useState } from 'react';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Listing } from '@loane/shared';
import { db } from '../firebase/config';

export function useListingsByIds(ids: string[], enabled: boolean) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);

  // A stable key, so re-rendering with a fresh array does not refetch.
  const key = ids.join(',');

  useEffect(() => {
    const wanted = key ? key.split(',') : [];
    if (!enabled || wanted.length === 0) return;

    let live = true;
    setLoading(true);
    void (async () => {
      try {
        const found: Listing[] = [];
        // `in` takes at most thirty, and a post tags at most six, so
        // this is one query in practice. The loop is here so it stays
        // correct if that limit ever moves.
        for (let i = 0; i < wanted.length; i += 30) {
          const snap = await getDocs(
            query(
              collection(db, COLLECTIONS.listings),
              where(documentId(), 'in', wanted.slice(i, i + 30)),
            ),
          );
          found.push(...snap.docs.map((d) => ({ ...(d.data() as Listing), id: d.id })));
        }
        if (!live) return;
        // Keep the order the post tagged them in.
        const byId = new Map(found.map((l) => [l.id, l]));
        setListings(wanted.map((id) => byId.get(id)).filter((l): l is Listing => Boolean(l)));
      } catch {
        if (live) setListings([]);
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [key, enabled]);

  return { listings, loading };
}
