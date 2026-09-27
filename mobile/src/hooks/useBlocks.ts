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

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useHiddenUids(): Set<string> {
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

  return useMemo(() => new Set([...blocked, ...blockedBy]), [blocked, blockedBy]);
}

/** Just the people she blocked, for a "Blocked" settings list. */
export function useBlockedUids(): string[] {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [blocked, setBlocked] = useState<string[]>([]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      collection(db, COLLECTIONS.users, uid, 'blocked'),
      (snap) => setBlocked(snap.docs.map((d) => d.id)),
      () => setBlocked([]),
    );
  }, [uid]);

  return blocked;
}
