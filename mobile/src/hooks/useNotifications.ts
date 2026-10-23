/**
 * In-app alerts — what the Activity tab shows and what the badge counts.
 *
 * These are written by Cloud Functions as things happen to a booking.
 * Push notifications are Phase 6; until then this is the only way a
 * student finds out her request was accepted, so it has to be reliable
 * rather than decorative.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { COLLECTIONS, PAGE_SIZES, isHiddenNotification, type Notification } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { useHiddenUids } from './useBlocks';
import { useRetry } from './useRetry';

/**
 * Her updates, newest first, a page at a time.
 *
 * This used to stop at the latest 50, so anything older simply
 * vanished. Now it is the same growing window as comments: one live
 * listener holding a page, widened by a page as she nears the bottom, so
 * everything on screen stays live (a read mark lands at once) and older
 * updates are still there if she scrolls for them.
 */
export function useNotifications() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [windowSize, setWindowSize] = useState<number>(PAGE_SIZES.updates);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { attempt, retry } = useRetry();

  // Someone else signing in on this phone starts from one page again.
  useEffect(() => setWindowSize(PAGE_SIZES.updates), [uid]);

  useEffect(() => {
    setFailed(false);
    if (!uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    // Only the first page shows the full-screen loader; a wider window
    // keeps the list she is reading and shows the footer spinner.
    if (windowSize === PAGE_SIZES.updates) setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.users, uid, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(windowSize),
      ),
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ ...(d.data() as Notification), id: d.id })));
        setHasMore(snap.docs.length >= windowSize);
        setLoading(false);
        setLoadingMore(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
        setLoadingMore(false);
      },
    );
  }, [uid, windowSize, attempt]);

  /** Near the bottom: hold one more page. */
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    setWindowSize((n) => n + PAGE_SIZES.updates);
  }, [hasMore, loadingMore, loading]);

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

  // Likes, comments and follows from someone blocked either way are
  // hidden. Rental alerts are not — see isHiddenNotification.
  const hidden = useHiddenUids();
  const visible = useMemo(
    () => notifications.filter((n) => !isHiddenNotification(n, hidden)),
    [notifications, hidden],
  );

  return { notifications: visible, loading, failed, retry, markRead, hasMore, loadMore, loadingMore };
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
  const [unread, setUnread] = useState<Notification[]>([]);
  const hidden = useHiddenUids();

  useEffect(() => {
    if (!uid) {
      setUnread([]);
      return;
    }
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.users, uid, 'notifications'),
        where('readAt', '==', null),
        limit(50),
      ),
      (snap) => setUnread(snap.docs.map((d) => d.data() as Notification)),
      () => setUnread([]),
    );
  }, [uid]);

  // Same filter as the list, so the badge never counts an alert she
  // cannot find on the Activity tab.
  return unread.filter((n) => !isHiddenNotification(n, hidden)).length;
}
