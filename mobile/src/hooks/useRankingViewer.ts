/**
 * What the "For You" ranking knows about HER — shared by the feed (D4)
 * and Discover (D5).
 *
 * Read once per screen open, not watched: her last 100 likes (who she
 * likes, and which looks) and who follows her (for the "mutual" bonus).
 * Who she follows is the live listener the screens already use.
 *
 * Every read failing falls back to empty: the screen is still the
 * screen, just less personal — never an error.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Follow, type Like } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { useFollowingUids } from './useFollowing';

/** How many of her likes teach the ranking her taste. */
const LIKES_READ = 100;
/** A safety cap on the follower read; mutuals past this just score as follows. */
const FOLLOWERS_READ = 500;

export interface RankingViewerData {
  uid: string;
  following: Set<string>;
  followers: Set<string>;
  likes: Like[];
  /** Author uid → how many of their looks she has liked. */
  interactions: Map<string, number>;
}

export function useRankingViewer() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const { uids: following, loading: followingLoading } = useFollowingUids();

  const [read, setRead] = useState<{ likes: Like[]; followers: Set<string> } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    // Only the first read blanks it; a refresh keeps the old one up
    // until the new one lands, so the screen never flashes a loader.
    if (attempt === 0) setRead(null);
    void (async () => {
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
      if (live) setRead({ likes, followers });
    })();
    return () => {
      live = false;
    };
  }, [uid, attempt]);

  /** Read her likes and followers again (pull to refresh). */
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const data = useMemo<RankingViewerData | null>(() => {
    if (!uid || !read || followingLoading) return null;
    const interactions = new Map<string, number>();
    for (const like of read.likes) {
      interactions.set(like.postAuthorUid, (interactions.get(like.postAuthorUid) ?? 0) + 1);
    }
    return { uid, following, followers: read.followers, likes: read.likes, interactions };
  }, [uid, read, following, followingLoading]);

  return { viewer: data, reload };
}
