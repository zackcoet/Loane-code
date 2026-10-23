/**
 * Muting — hiding someone's looks from her feed without blocking.
 *
 * Instagram's "Mute". The muted person is never told and nothing changes
 * for her: she can still message, follow and rent, and her closet and
 * profile still open. Only HER looks stop appearing in this student's
 * feed. Blocking is the tool for anything stronger.
 *
 * Written straight to Firestore: it changes only what she herself sees.
 * The security rules pin the shape (users/{uid}/muted/{otherUid}).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { logEvent } from '../analytics/events';
import { assertOnline } from '../network/connection';

/** Everyone she has muted, live. */
export function useMutedUids(): { uids: Set<string>; list: string[]; loading: boolean } {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [list, setList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      collection(db, COLLECTIONS.users, uid, SUBCOLLECTIONS.userMuted),
      (snap) => {
        setList(snap.docs.map((d) => d.id));
        setLoading(false);
      },
      () => {
        setList([]);
        setLoading(false);
      },
    );
  }, [uid]);

  const uids = useMemo(() => new Set(list), [list]);
  return { uids, list, loading };
}

export async function setUserMuted(myUid: string, otherUid: string, muted: boolean): Promise<void> {
  assertOnline();
  const ref = doc(db, COLLECTIONS.users, myUid, SUBCOLLECTIONS.userMuted, otherUid);
  if (muted) await setDoc(ref, { mutedUid: otherUid, createdAt: serverTimestamp() });
  else await deleteDoc(ref);
  logEvent(muted ? 'user_muted' : 'user_unmuted', {
    surface: 'other',
    targetType: 'user',
    targetId: otherUid,
  });
}
