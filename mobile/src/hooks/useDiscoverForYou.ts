/**
 * Discover's "For you" order — NORTH_STAR D5.
 *
 * Ranks the campus pieces already loaded for Discover with
 * `rankListings` (shared/src/discoverRanking.ts) and returns each
 * piece's place, which useDiscoverResults sorts by.
 *
 * Her taste in occasions comes from the pieces she has saved (her last
 * 60 saves — one small read; the pieces themselves are already loaded).
 * Who she follows, who follows her and whose looks she likes come from
 * useRankingViewer, the same as the feed.
 *
 * THE GRID DOES NOT SHUFFLE WHILE SHE BROWSES. Pieces are a live list,
 * so a save anywhere on campus changes a count; re-ranking on every
 * change would move tiles under her finger. The order is worked out
 * when the SET of pieces changes (one added or removed) or her likes
 * are read again — not when a count moves.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  buildOccasionAffinity,
  occasionsOfSaved,
  rankListings,
  toIsoDate,
  type Listing,
  type Save,
} from '@loane/shared';
import { db } from '../firebase/config';
import type { RankingViewerData } from './useRankingViewer';

const SAVES_READ = 60;

const createdAtMs = (l: Listing): number | null => {
  const v = l.createdAt as Timestamp | null | undefined;
  return v && typeof v.toMillis === 'function' ? v.toMillis() : null;
};

/**
 * Listing id → place in her "For you" order (0 is first). Null until
 * her side has been read; Discover shows newest first meanwhile.
 */
export function useDiscoverForYou(
  listings: Listing[],
  viewer: RankingViewerData | null,
): Map<string, number> | null {
  const uid = viewer?.uid ?? null;
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    getDocs(
      query(
        collection(db, COLLECTIONS.saves),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(SAVES_READ),
      ),
    )
      .then((s) => s.docs.map((d) => (d.data() as Save).listingId))
      // Not worth an error: the grid is still ranked, just without taste.
      .catch(() => [] as string[])
      .then((ids) => {
        if (live) setSavedIds(ids);
      });
    return () => {
      live = false;
    };
  }, [uid]);

  // The latest pieces, read through a ref so a count changing does not
  // re-rank (see the comment at the top).
  const latest = useRef(listings);
  latest.current = listings;
  const idsKey = useMemo(
    () =>
      listings
        .map((l) => l.id)
        .sort()
        .join(','),
    [listings],
  );

  return useMemo(() => {
    if (!viewer || !savedIds) return null;
    const current = latest.current;
    const byId = new Map(current.map((l) => [l.id, l]));
    const now = new Date();
    const order = rankListings(
      current,
      createdAtMs,
      {
        uid: viewer.uid,
        following: viewer.following,
        followers: viewer.followers,
        interactions: viewer.interactions,
        occasionAffinity: buildOccasionAffinity(occasionsOfSaved(savedIds, (id) => byId.get(id))),
      },
      now.getTime(),
      toIsoDate(now),
    );
    return new Map(order.map((id, i) => [id, i]));
    // Deliberately keyed on the SET of pieces and her likes, not on every
    // listing object: see the comment at the top.
  }, [idsKey, viewer?.likes, viewer?.following, savedIds]);
}
