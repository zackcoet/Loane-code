/**
 * Her private settings document: contact details and notification
 * preferences. Only she and an admin can read it, which is why it lives in
 * a subcollection rather than on the public profile.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { COLLECTIONS, type UserPrivate } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useUserSettings() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [settings, setSettings] = useState<UserPrivate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, COLLECTIONS.users, uid, 'private', 'settings'),
      (snap) => {
        setSettings(snap.exists() ? (snap.data() as UserPrivate) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  const save = async (patch: Partial<UserPrivate>) => {
    if (!uid) return;
    await setDoc(
      doc(db, COLLECTIONS.users, uid, 'private', 'settings'),
      { ...patch, uid, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  return { settings, loading, save };
}
