/**
 * Reading profiles — her own, and other students'.
 */

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { COLLECTIONS, type Listing, type Post, type User, ids } from '@loane/shared';
import { db } from '../firebase/config';
import { useRetry } from './useRetry';
import { useAuth } from '../auth/AuthProvider';

const PAGE_SIZE = 40;

/**
 * Looks a profile up by @username.
 *
 * Firestore cannot query "the user whose username is X" cheaply, but the
 * `usernames` lock document already maps a handle to a uid — the same
 * documents that make handles unique. So this is two point reads, not a
 * query.
 */
export function useProfileByUsername(username: string | undefined) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
    if (!username) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    getDoc(doc(db, COLLECTIONS.usernames, username.toLowerCase()))
      .then((lock) => {
        if (cancelled) return;
        if (!lock.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const uid = (lock.data() as { uid: string }).uid;
        return getDoc(doc(db, COLLECTIONS.users, uid)).then((snap) => {
          if (cancelled) return;
          if (!snap.exists()) setNotFound(true);
          else setUser(snap.data() as User);
          setLoading(false);
        });
      })
      .catch((err: { code?: string }) => {
        if (cancelled) return;
        // Refused by the rules really is "not there". Anything else (no
        // signal, a timeout) is worth a retry — "closet not found" on a
        // bad connection would be wrong.
        if (err.code === 'permission-denied') setNotFound(true);
        else setFailed(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, attempt]);

  return { user, loading, notFound, failed, retry };
}

/**
 * One student, live, by uid.
 *
 * Used where a rating has to be current — the lender card on a listing,
 * for instance. The denormalized UserSummary carried on a listing
 * deliberately does NOT include the rating: it would have to be fanned
 * out to every listing and post she owns each time somebody reviewed
 * her, and a stale star count is worse than an extra read.
 */
export function useUserById(uid: string | undefined) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!uid) {
      setUser(null);
      return;
    }
    return onSnapshot(
      doc(db, COLLECTIONS.users, uid),
      (snap) => setUser(snap.exists() ? (snap.data() as User) : null),
      () => setUser(null),
    );
  }, [uid]);

  return user;
}

/** Live posts by one author. */
export function useUserPosts(uid: string | undefined) {
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.posts),
        where('authorUid', '==', uid),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ),
      (snap) => {
        setItems(
          snap.docs
            .map((d) => ({ ...(d.data() as Post), id: d.id }))
            .filter((post) => post.settings?.hideFromProfile !== true),
        );
        setLoading(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
      },
    );
  }, [uid, attempt]);

  return { items, loading, failed, retry };
}

/**
 * Live listings in one student's closet.
 *
 * `includeHidden` is for her OWN My Listings screen, where she needs to
 * see paused and removed pieces too. Everyone else only ever sees active
 * ones.
 */
export function useUserListings(uid: string | undefined, includeHidden = false) {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.listings),
        where('ownerUid', '==', uid),
        ...(includeHidden
          ? [where('status', 'in', ['active', 'paused', 'draft', 'removed'])]
          : [where('status', '==', 'active')]),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ),
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...(d.data() as Listing), id: d.id })));
        setLoading(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
      },
    );
  }, [uid, includeHidden, attempt]);

  return { items, loading, failed, retry };
}

/**
 * Am I following this person?
 *
 * The follow edge id is `{me}_{them}`, so this is one point read rather
 * than a query.
 */
export function useIsFollowing(targetUid: string | undefined) {
  const { profile } = useAuth();
  const myUid = profile?.uid;
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid || !targetUid || myUid === targetUid) {
      setFollowing(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, COLLECTIONS.follows, ids.follow(myUid, targetUid)),
      (snap) => {
        setFollowing(snap.exists());
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [myUid, targetUid]);

  return { following, loading };
}
