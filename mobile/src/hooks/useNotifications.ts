/**
 * In-app alerts — what the Activity tab shows and what the badge counts.
 *
 * These are written by Cloud Functions as things happen to a booking.
 * Push notifications are Phase 6; until then this is the only way a
 * student finds out her request was accepted, so it has to be reliable
 * rather than decorative.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { COLLECTIONS, type Notification } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useNotifications() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.users, uid, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ ...(d.data() as Notification), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!uid) return;
      await updateDoc(doc(db, COLLECTIONS.users, uid, 'notifications', notificationId), {
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    },
    [uid],
  );

  return { notifications, loading, markRead };
}

/**
 * Just the unread count, for the tab-bar badge.
 *
 * A separate, narrower listener so the badge does not depend on the
 * Activity screen being open.
 */
export function useUnreadCount(): number {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.users, uid, 'notifications'),
        where('readAt', '==', null),
        limit(50),
      ),
      (snap) => setCount(snap.size),
      () => setCount(0),
    );
  }, [uid]);

  return count;
}
