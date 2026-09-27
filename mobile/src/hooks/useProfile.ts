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
import { COLLECTIONS, ids, type Listing, type Post, type User } from '@loane/shared';
import { db } from '../firebase/config';
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

  useEffect(() => {
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
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  return { user, loading, notFound };
}

/** Live posts by one author. */
export function useUserPosts(uid: string | undefined) {
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        setItems(snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { items, loading };
}

/** Live listings in one student's closet. */
export function useUserListings(uid: string | undefined) {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ),
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...(d.data() as Listing), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { items, loading };
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
