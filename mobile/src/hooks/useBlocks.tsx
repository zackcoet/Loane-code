/**
 * Who she cannot see, and who cannot see her.
 *
 * Two lists, unioned: people she blocked, and people who blocked her.
 * Her app filters both out of the feed, Discover and search.
 *
 * This is the half of blocking that runs on the phone. The half that
 * matters — messaging, renting, following — is refused by the server.
 * See docs/security.md; the seam is real and written down.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

const EMPTY: Set<string> = new Set();
const HiddenUidsContext = createContext<Set<string>>(EMPTY);

/**
 * Listens to both lists ONCE for the whole app. Every look card checks
 * "Liked by" against this, so a listener per card would be dozens of
 * identical subscriptions on one scroll of the feed.
 */
export function BlocksProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [blocked, setBlocked] = useState<string[]>([]);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);

  useEffect(() => {
    if (!uid) {
      setBlocked([]);
      setBlockedBy([]);
      return;
    }
    const a = onSnapshot(
      collection(db, COLLECTIONS.users, uid, 'blocked'),
      (snap) => setBlocked(snap.docs.map((d) => d.id)),
      () => setBlocked([]),
    );
    const b = onSnapshot(
      collection(db, COLLECTIONS.users, uid, 'blockedBy'),
      (snap) => setBlockedBy(snap.docs.map((d) => d.id)),
      () => setBlockedBy([]),
    );
    return () => {
      a();
      b();
    };
  }, [uid]);

  const hidden = useMemo(
    () => (blocked.length + blockedBy.length === 0 ? EMPTY : new Set([...blocked, ...blockedBy])),
    [blocked, blockedBy],
  );

  return <HiddenUidsContext.Provider value={hidden}>{children}</HiddenUidsContext.Provider>;
}

/** Everyone blocked either way. Empty until she is signed in. */
export function useHiddenUids(): Set<string> {
  return useContext(HiddenUidsContext);
}

/**
 * Just the people she blocked, for the "Blocked" settings list.
 *
 * Unlike the provider above, this says when it is still loading and
 * when it failed, so the list can tell "nobody blocked" apart from
 * "couldn't check" — saying "Nobody blocked" on a bad signal would
 * make her think a block had come undone.
 */
export function useBlockedUids(): {
  list: string[];
  loading: boolean;
  failed: boolean;
  retry: () => void;
} {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [list, setList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    return onSnapshot(
      collection(db, COLLECTIONS.users, uid, 'blocked'),
      (snap) => {
        setList(snap.docs.map((d) => d.id));
        setFailed(false);
        setLoading(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
      },
    );
  }, [uid, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { list, loading, failed, retry };
}
