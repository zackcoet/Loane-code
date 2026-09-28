/**
 * The set of uids the signed-in student follows.
 *
 * Used by Discover's Following tab. A Set rather than a list because the
 * only question ever asked is "is this owner one of them?".
 */

import { useEffect, useState } from 'react';
import {
  collection,
  documentId,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { COLLECTIONS, type Follow, type User, type UserSummary } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useFollowingUids() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [uids, setUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setUids(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(collection(db, COLLECTIONS.follows), where('followerUid', '==', uid)),
      (snap) => {
        setUids(new Set(snap.docs.map((d) => (d.data() as Follow).followingUid)));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { uids, loading };
}

/**
 * People she could reasonably send a look to: everyone she follows, and
 * everyone who follows her.
 *
 * Both directions, because the person most likely to want to see a
 * dress is either someone whose taste she follows or someone who
 * already watches hers. Anyone else she finds by typing a name.
 *
 * A follow row holds only the two uids, so the profiles are read
 * separately, thirty at a time — that is the most an `in` query takes.
 * Read once rather than watched live: the list is a picker, and someone
 * following her mid-send does not need to make the list jump.
 */
export function useSuggestedRecipients() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPeople([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);

    void (async () => {
      try {
        const [following, followers] = await Promise.all([
          getDocs(query(collection(db, COLLECTIONS.follows), where('followerUid', '==', uid))),
          getDocs(query(collection(db, COLLECTIONS.follows), where('followingUid', '==', uid))),
        ]);

        const uids = new Set<string>();
        following.docs.forEach((d) => uids.add((d.data() as Follow).followingUid));
        followers.docs.forEach((d) => uids.add((d.data() as Follow).followerUid));
        uids.delete(uid);

        const found = await readUsers([...uids]);
        if (!live) return;
        setPeople(found.sort((a, b) => a.displayName.localeCompare(b.displayName)));
      } catch {
        if (live) setPeople([]);
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [uid]);

  return { people, loading };
}

/** Profiles by uid, in chunks of thirty — the most an `in` query takes. */
async function readUsers(uids: string[]): Promise<UserSummary[]> {
  const out: UserSummary[] = [];
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.users), where(documentId(), 'in', chunk)),
    );
    for (const d of snap.docs) {
      const user = d.data() as User;
      // A suspended or deactivated account is not someone to send to.
      if (user.status !== 'active') continue;
      out.push({
        uid: user.uid,
        username: user.username,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        campusId: user.campusId,
        isVerified: user.isVerified,
      });
    }
  }
  return out;
}

/**
 * Students on her campus whose username or name starts with what she
 * typed.
 *
 * Firestore has no substring search, so this is a prefix range on a
 * lowercase username — which is what people type when they are looking
 * for a specific person anyway. Anything cleverer needs a search index,
 * and that is not worth a service for MVP.
 */
export function useStudentSearch(term: string) {
  const { profile } = useAuth();
  const [results, setResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = term.trim().toLowerCase().replace(/^@/, '');
    if (!profile || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let live = true;
    setSearching(true);
    // Wait for her to stop typing. Every keystroke is otherwise a query.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const snap = await getDocs(
            query(
              collection(db, COLLECTIONS.users),
              where('campusId', '==', profile.campusId),
              where('username', '>=', q),
              where('username', '<=', `${q}\uf8ff`),
            ),
          );
          if (!live) return;
          setResults(
            snap.docs
              .map((d) => d.data() as User)
              .filter((user) => user.status === 'active' && user.uid !== profile.uid)
              .slice(0, 20)
              .map((user) => ({
                uid: user.uid,
                username: user.username,
                displayName: user.displayName,
                photoUrl: user.photoUrl,
                campusId: user.campusId,
                isVerified: user.isVerified,
              })),
          );
        } catch {
          if (live) setResults([]);
        } finally {
          if (live) setSearching(false);
        }
      })();
    }, 300);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term, profile]);

  return { results, searching };
}

/**
 * Everyone who follows a student, or everyone she follows.
 *
 * Live, because the point of opening her Following list on your own
 * profile is usually to unfollow somebody, and the row should leave the
 * list when you do.
 */
export function useFollowList(uid: string | undefined, side: 'followers' | 'following') {
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPeople([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);

    // Followers are the rows pointing AT her; following are the rows
    // pointing away from her.
    const field = side === 'followers' ? 'followingUid' : 'followerUid';
    const other = side === 'followers' ? 'followerUid' : 'followingUid';

    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.follows), where(field, '==', uid)),
      (snap) => {
        const uids = snap.docs.map((d) => (d.data() as Follow)[other]);
        if (uids.length === 0) {
          if (live) {
            setPeople([]);
            setLoading(false);
          }
          return;
        }
        void readUsers(uids)
          .then((found) => {
            if (!live) return;
            setPeople(found.sort((a, b) => a.displayName.localeCompare(b.displayName)));
            setLoading(false);
          })
          .catch(() => {
            if (live) setLoading(false);
          });
      },
      () => {
        if (live) setLoading(false);
      },
    );

    return () => {
      live = false;
      unsubscribe();
    };
  }, [uid, side]);

  return { people, loading };
}
