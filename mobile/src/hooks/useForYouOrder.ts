/**
 * The All Campus order — NORTH_STAR D4.
 *
 * Takes the looks the feed has loaded (newest first, a page at a time)
 * and returns them in "For You" order: scored by feedRanking.ts, then
 * spread out by feedOrder.ts so no girl takes three slots in a row and
 * new closets keep appearing. Following stays newest-first and does not
 * use this.
 *
 * WHAT IT READS, ONCE PER FEED OPEN:
 * - her last 100 likes (who she likes, and the occasions she likes);
 * - who follows her, for the "mutual" bonus — read once, not watched;
 * - the pieces tagged in each look, 30 per read, each piece once, for
 *   "can she actually get it this week".
 * Who she follows comes in from the feed's own live listener.
 *
 * Every one of these is HER data or a listing she cannot edit, which is
 * why ranking on her phone is safe: see docs/decisions.md (run 15).
 *
 * NOTHING JUMPS: once a look has a place it keeps it until she pulls to
 * refresh (see `nextFeedOrder`). A look waits off-screen until its
 * pieces have been read, so it lands in its proper place once rather
 * than moving later. If a read fails the look still appears, scored as
 * if its pieces were unavailable — a missing bonus, never a missing look.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  documentId,
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
  nextFeedOrder,
  toIsoDate,
  type Follow,
  type Like,
  type Listing,
  type Occasion,
  type Post,
} from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

/** How many of her likes teach the ranking her taste. */
const LIKES_READ = 100;
/** A safety cap on the follower read; mutuals past this just score as follows. */
const FOLLOWERS_READ = 500;

const createdAtMs = (p: Post): number | null => {
  const v = p.createdAt as Timestamp | null | undefined;
  return v && typeof v.toMillis === 'function' ? v.toMillis() : null;
};

interface Viewer {
  followers: Set<string>;
  likes: Like[];
}

export function useForYouOrder(posts: Post[], following: Set<string>, followingLoading: boolean) {
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  /** The ids in the order she sees them. A ref: placing a look is not a render. */
  const order = useRef<string[]>([]);

  // --- Her side: likes and followers, read once per feed open ------------
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [viewerAttempt, setViewerAttempt] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    // Only the first read shows the loader; a refresh keeps the feed up.
    if (viewerAttempt === 0) setViewer(null);
    void (async () => {
      // Either read failing is not worth an error screen: the feed is
      // still the feed, just less personal. Fall back to empty.
      const [likes, followers] = await Promise.all([
        getDocs(
          query(
            collection(db, COLLECTIONS.likes),
            where('uid', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(LIKES_READ),
          ),
        )
          .then((s) => s.docs.map((d) => d.data() as Like))
          .catch(() => [] as Like[]),
        getDocs(
          query(
            collection(db, COLLECTIONS.follows),
            where('followingUid', '==', uid),
            limit(FOLLOWERS_READ),
          ),
        )
          .then((s) => new Set(s.docs.map((d) => (d.data() as Follow).followerUid)))
          .catch(() => new Set<string>()),
      ]);
      if (!live) return;
      // Fresh likes mean a fresh order: forget every placed look.
      order.current = [];
      setViewer({ likes, followers });
    })();
    return () => {
      live = false;
    };
  }, [uid, viewerAttempt]);

  // --- The pieces tagged in each look, each read once --------------------
  // null = read, but gone or unreadable: scored as unavailable.
  const listingCache = useRef(new Map<string, Listing | null>());
  const inFlight = useRef(new Set<string>());
  const [listingsVersion, setListingsVersion] = useState(0);

  const missingIds = useMemo(() => {
    const out = new Set<string>();
    for (const p of posts) {
      for (const id of p.taggedListingIds ?? []) {
        if (!listingCache.current.has(id) && !inFlight.current.has(id)) out.add(id);
      }
    }
    return [...out];
    // listingsVersion is a dependency on purpose: re-check once a batch lands.
  }, [posts, listingsVersion]);

  useEffect(() => {
    if (missingIds.length === 0) return;
    for (const id of missingIds) inFlight.current.add(id);
    void (async () => {
      for (let i = 0; i < missingIds.length; i += 30) {
        const batch = missingIds.slice(i, i + 30);
        try {
          const snap = await getDocs(
            query(collection(db, COLLECTIONS.listings), where(documentId(), 'in', batch)),
          );
          const found = new Map(
            snap.docs.map((d) => [d.id, { ...(d.data() as Listing), id: d.id }]),
          );
          for (const id of batch) listingCache.current.set(id, found.get(id) ?? null);
        } catch {
          for (const id of batch) listingCache.current.set(id, null);
        } finally {
          for (const id of batch) inFlight.current.delete(id);
        }
      }
      // Not tied to an unmount check: the cache outlives a re-render and
      // the bump is harmless if the feed has gone.
      setListingsVersion((n) => n + 1);
    })();
  }, [missingIds]);

  // --- The order ---------------------------------------------------------

  const viewerReady = viewer !== null && !followingLoading;

  const ranked = useMemo(() => {
    if (!uid || !viewerReady) return null;
    // Only looks whose pieces have all been read get a place.
    const ready = posts.filter((p) =>
      (p.taggedListingIds ?? []).every((id) => listingCache.current.has(id)),
    );

    const interactions = new Map<string, number>();
    const likedIds = new Set<string>();
    for (const like of viewer.likes) {
      interactions.set(like.postAuthorUid, (interactions.get(like.postAuthorUid) ?? 0) + 1);
      likedIds.add(like.postId);
    }
    // Her taste in occasions, from the looks she liked that are loaded.
    // A first pass is enough: it only has to say "she likes Gameday".
    const likedOccasions: Occasion[][] = posts
      .filter((p) => likedIds.has(p.id))
      .map((p) => p.occasions ?? []);

    const now = new Date();
    order.current = nextFeedOrder(order.current, ready, createdAtMs, {
      viewer: {
        uid,
        following,
        followers: viewer.followers,
        interactions,
        occasionAffinity: buildOccasionAffinity(likedOccasions),
      },
      listings: (id) => listingCache.current.get(id) ?? undefined,
      nowMs: now.getTime(),
      today: toIsoDate(now),
    });

    const byId = new Map(posts.map((p) => [p.id, p]));
    return {
      posts: order.current.map((id) => byId.get(id)!).filter(Boolean),
      waiting: ready.length < posts.length,
    };
    // listingsVersion is a dependency on purpose: the cache it counts is a ref.
  }, [uid, viewerReady, viewer, posts, following, listingsVersion]);

  /**
   * Pull to refresh: read her likes again, then work the whole order out
   * from scratch once they land. The feed stays on screen meanwhile —
   * no loader flash — and reorders once.
   */
  const reset = useCallback(() => setViewerAttempt((n) => n + 1), []);

  const placed = ranked?.posts ?? [];
  return {
    posts: placed,
    /** Nothing placed yet while something is still being read. */
    pending: ranked === null || (placed.length === 0 && ranked.waiting),
    /** Some looks are loaded but still waiting for their pieces. */
    waiting: ranked === null || ranked.waiting,
    reset,
  };
}
