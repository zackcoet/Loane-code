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

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { assertOnline, OfflineError } from '../network/connection';

/**
 * Everyone she has muted, live.
 *
 * `failed` is for the Muted list, which must not say "Nobody muted" when
 * it simply couldn't check. The feed ignores it: if the list can't load,
 * the worst case is a muted girl's look showing, which is harmless.
 */
export function useMutedUids(): {
  uids: Set<string>;
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
      collection(db, COLLECTIONS.users, uid, SUBCOLLECTIONS.userMuted),
      (snap) => {
        setList(snap.docs.map((d) => d.id));
        setFailed(false);
        setLoading(false);
      },
      () => {
        setList([]);
        setFailed(true);
        setLoading(false);
      },
    );
  }, [uid, attempt]);

  const uids = useMemo(() => new Set(list), [list]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { uids, list, loading, failed, retry };
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

/**
 * What to tell her when muting or unmuting fails. With no signal the
 * write is refused before it leaves the phone, and "try again" would
 * send her tapping something only a signal will fix.
 */
export function muteErrorMessage(error: unknown, fallback: string): string {
  return error instanceof OfflineError ? error.message : fallback;
}
