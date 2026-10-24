/**
 * Messaging.
 *
 * Messages are written straight to Firestore by the app and arrive over
 * a realtime listener, so a chat feels like a chat. A trigger tidies up
 * the thread's preview and unread badge a moment later — see
 * onMessageCreated for why that is not a callable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  endAt,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  increment,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  INBOX_BADGE_WINDOW,
  LIMITS,
  PAGE_SIZES,
  docPresence,
  inboxUnreadTotal,
  isLastPage,
  mergePages,
  needsMarkRead,
  otherQuotaWrite,
  quotaWrite,
  splitInbox,
  visibleAfterDelete,
  type Conversation,
  type ImageRef,
  type Message,
  type MessageQuota,
  type MessageReply,
} from '@loane/shared';
import { db } from '../firebase/config';
import { snapshotRows } from '../firebase/snapshotRows';
import { useAuth } from '../auth/AuthProvider';
import { logEvent } from '../analytics/events';
import { hapticSend } from '../haptics';
import { useHiddenUids } from './useBlocks';
import { useFollowingUids } from './useFollowing';
import { useUserSettings } from './useUserSettings';
import { useRetry } from './useRetry';
import { assertOnline, isCachedEmpty } from '../network/connection';

/** Thrown by send when she has hit the hourly ceiling. */
export const MESSAGE_QUOTA_FULL = 'message-quota-full';

/**
 * Writes one message together with one tick of her hourly counter. See
 * shared/src/messageQuota.ts for why the two travel together.
 */
async function sendCounted(
  conversationId: string,
  uid: string,
  message: Record<string, unknown>,
  quota: 'start' | 'bump',
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, COLLECTIONS.conversations, conversationId, 'messages')), message);
  const quotaDoc = doc(db, COLLECTIONS.messageQuotas, uid);
  if (quota === 'start') batch.set(quotaDoc, { windowStart: serverTimestamp(), count: 1 });
  else batch.update(quotaDoc, { count: increment(1) });
  await batch.commit();
}

/**
 * Her most recently active chats, newest first, as one live listener of
 * `windowSize` chats. The badge holds a fixed window; the inbox screen
 * widens hers a page at a time as she scrolls (useInbox).
 */
function useConversationWindow(windowSize: number) {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { attempt, retry } = useRetry();

  useEffect(() => {
    setFailed(false);
    if (!uid) {
      setConversations([]);
      setLoading(false);
      return;
    }
    // Only the first window shows the full-screen loader; a wider one
    // keeps the list she is reading and shows the footer spinner.
    if (windowSize === PAGE_SIZES.inbox) setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.conversations),
        where('participantUids', 'array-contains', uid),
        orderBy('updatedAt', 'desc'),
        limit(windowSize),
      ),
      (snap) => {
        // No signal and nothing cached: an empty answer here is a guess,
        // not "you have none". Say it could not load (shared/connection.ts).
        if (isCachedEmpty(snap)) {
          setFailed(true);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        setFailed(false);
        setConversations(snap.docs.map((d) => ({ ...(d.data() as Conversation), id: d.id })));
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

  return { conversations, loading, failed, retry, hasMore, loadingMore, setLoadingMore };
}

/**
 * Her inbox split the way the screen shows it: the threads she reads,
 * and the message requests from people she does not follow. Deleted
 * threads are in neither until something new arrives.
 *
 * A page at a time: the same growing live window as Activity and
 * comments. One listener holds the first 50 chats and is widened by 50
 * as she nears the bottom, so every row on screen stays live (a new
 * message moves its chat to the top, a read clears its dot) and an
 * older chat is still there if she scrolls for it. It used to stop at
 * 50 — see docs/decisions.md.
 */
export function useInbox() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [windowSize, setWindowSize] = useState<number>(PAGE_SIZES.inbox);
  // Someone else signing in on this phone starts from one page again.
  useEffect(() => setWindowSize(PAGE_SIZES.inbox), [uid]);
  const { conversations, loading, failed, retry, hasMore, loadingMore, setLoadingMore } =
    useConversationWindow(windowSize);
  const { uids: following, loading: followingLoading } = useFollowingUids();
  // Threads with anyone blocked either way leave the inbox entirely.
  const hidden = useHiddenUids();
  const split = useMemo(
    () => (uid ? splitInbox(conversations, uid, following, hidden) : { inbox: [], requests: [] }),
    [conversations, uid, following, hidden],
  );

  /** Near the bottom: hold one more page of chats. */
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    setWindowSize((n) => n + PAGE_SIZES.inbox);
  }, [hasMore, loadingMore, loading, setLoadingMore]);

  // Wait for who she follows too, or a friend's thread would flash in
  // Requests for a moment on every open.
  return {
    ...split,
    loading: loading || followingLoading,
    failed,
    retry,
    hasMore,
    loadMore,
    loadingMore,
  };
}

/**
 * Total unread for the Messages badge. Muted threads, deleted threads
 * and requests do not count — see inboxUnreadTotal.
 *
 * Reads its own fixed window of her most recent chats, not the inbox
 * screen's, so scrolling Messages never changes the number and the
 * badge never waits on a list she may never open. Why 50 recent chats
 * is enough: INBOX_BADGE_WINDOW.
 */
export function useUnreadMessageCount(): number {
  const { profile } = useAuth();
  const { conversations } = useConversationWindow(INBOX_BADGE_WINDOW);
  const { uids: following } = useFollowingUids();
  const hidden = useHiddenUids();
  const uid = profile?.uid;
  if (!uid) return 0;
  return inboxUnreadTotal(conversations, uid, following, hidden);
}

/**
 * Deletes a thread from HER inbox only. The other person keeps it, and
 * it comes back for her when someone sends something new. Clears her
 * badge too — a deleted thread should not leave a number behind.
 */
export async function deleteThreadForMe(conversationId: string, uid: string): Promise<void> {
  assertOnline();
  await updateDoc(doc(db, COLLECTIONS.conversations, conversationId), {
    [`hiddenAt.${uid}`]: serverTimestamp(),
    [`unreadCounts.${uid}`]: 0,
  });
}

/** Mutes or unmutes a thread for her alone. */
export async function setThreadMuted(
  conversationId: string,
  uid: string,
  muted: boolean,
): Promise<void> {
  assertOnline();
  await updateDoc(doc(db, COLLECTIONS.conversations, conversationId), {
    mutedUids: muted ? arrayUnion(uid) : arrayRemove(uid),
  });
}

/** One thread: its messages, and how to send. */
export function useConversation(conversationId: string | undefined) {
  const { profile } = useAuth();
  const uid = profile?.uid;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  /** The live thread could not load: "Say hello" here would be a lie. */
  const [failed, setFailed] = useState(false);
  const { attempt, retry } = useRetry();
  const [exhausted, setExhausted] = useState(false);
  /**
   * The oldest message the live listener has to reach down to. Null
   * until she first scrolls up; after that the listener keeps
   * everything from now back to here live, so a message arriving never
   * pushes one out of the live window into a gap.
   */
  const [anchor, setAnchor] = useState<QueryDocumentSnapshot | null>(null);
  /** The oldest message loaded at all, where the next older page starts. */
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  /** The live listener's oldest document, kept for when she scrolls up. */
  const liveOldest = useRef<QueryDocumentSnapshot | null>(null);
  const inFlight = useRef(false);

  // A different chat starts from scratch.
  useEffect(() => {
    setLiveMessages([]);
    setOlderMessages([]);
    setExhausted(false);
    setOlderError(false);
    setAnchor(null);
    cursor.current = null;
    liveOldest.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, COLLECTIONS.conversations, conversationId),
      (snap) => {
        // No signal: a cached "missing" is not an answer. Keep what we
        // have; the listener fills in when the signal returns.
        if (docPresence(snap.exists(), snap.metadata.fromCache) === 'unknown') return;
        setConversation(snap.exists() ? { ...(snap.data() as Conversation), id: snap.id } : null);
      },
      () => setConversation(null),
    );
  }, [conversationId]);

  // --- The live part of the thread ----------------------------------------
  // At first: the newest page. Once she has scrolled up: everything from
  // now back to the anchor, so hearts, "Seen" and takedowns stay live on
  // what she has on screen.
  // An anchor from a chat she has just left is not this chat's.
  const liveAnchor = anchor?.ref.parent.parent?.id === conversationId ? anchor : null;
  useEffect(() => {
    if (!conversationId) return;
    setFailed(false);
    if (!liveAnchor) setLoading(true);
    const messagesRef = collection(db, COLLECTIONS.conversations, conversationId, 'messages');
    return onSnapshot(
      liveAnchor
        ? query(messagesRef, orderBy('createdAt', 'desc'), endAt(liveAnchor))
        : query(messagesRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZES.messages)),
      (snap) => {
        // Unchanged messages keep their object, so their bubbles skip
        // re-drawing when one new message lands.
        setLiveMessages((current) => snapshotRows(current, snap));
        if (!liveAnchor) {
          liveOldest.current = snap.docs[snap.docs.length - 1] ?? null;
          cursor.current = liveOldest.current;
          setExhausted(isLastPage(snap.docs.length, PAGE_SIZES.messages));
        }
        setLoading(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
      },
    );
  }, [conversationId, liveAnchor, attempt]);

  // --- Older messages, as she scrolls up ------------------------------------
  // Fetched once. Anything older than the live window is history, and a
  // listener per page would be a listener we keep paying for.
  const loadOlder = useCallback(async () => {
    if (!conversationId || inFlight.current || exhausted || loading || !cursor.current) return;
    inFlight.current = true;
    setLoadingOlder(true);
    setOlderError(false);
    try {
      // The first time, pin the live window where it is now.
      if (!anchor && liveOldest.current) setAnchor(liveOldest.current);
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.conversations, conversationId, 'messages'),
          orderBy('createdAt', 'desc'),
          startAfter(cursor.current),
          limit(PAGE_SIZES.messages),
        ),
      );
      const page = snap.docs.map((d) => ({ ...(d.data() as Message), id: d.id }));
      cursor.current = snap.docs[snap.docs.length - 1] ?? cursor.current;
      // If she deleted this chat once, nothing before that shows — so
      // reaching it is as good as reaching the start.
      const pastHerDelete = page.some((m) => !visibleAfterDelete(conversation, uid, m.createdAt));
      setExhausted(isLastPage(snap.docs.length, PAGE_SIZES.messages) || pastHerDelete);
      setOlderMessages((current) => mergePages(current, page));
    } catch {
      setOlderError(true);
    } finally {
      inFlight.current = false;
      setLoadingOlder(false);
    }
  }, [conversationId, exhausted, loading, anchor, conversation, uid]);

  const messages = useMemo(
    () => mergePages(liveMessages, olderMessages),
    [liveMessages, olderMessages],
  );

  // Her "Show read receipts" switch. On until she turns it off.
  const { settings } = useUserSettings();
  const receiptsOn = settings?.messaging?.readReceipts ?? true;

  // Her hourly message counter, kept live so sending never waits on a
  // read to know which write to batch with the message.
  const quotaRef = useRef<MessageQuota | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, COLLECTIONS.messageQuotas, uid),
      (snap) => {
        quotaRef.current = snap.exists() ? (snap.data() as MessageQuota) : null;
      },
      () => {},
    );
  }, [uid]);

  /**
   * Clears her own badge and stamps when she last had the thread open,
   * which is what shows "Seen" to the other person. The rules allow
   * only her own keys, and only the server's clock.
   *
   * needsMarkRead checks first, because this runs on every snapshot of
   * an open chat and a write per snapshot would loop.
   */
  const markRead = useCallback(async () => {
    if (!conversationId || !uid) return;
    if (!needsMarkRead(conversation, messages, uid, receiptsOn)) return;
    await updateDoc(doc(db, COLLECTIONS.conversations, conversationId), {
      [`unreadCounts.${uid}`]: 0,
      // With "Show read receipts" off, her badge clears but nobody is
      // told she has seen anything.
      ...(receiptsOn ? { [`lastReadAt.${uid}`]: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, [conversationId, uid, conversation, messages, receiptsOn]);

  const send = useCallback(
    async (body: string, photo?: ImageRef, replyTo?: MessageReply | null) => {
      const text = body.trim();
      // A photo on its own is a perfectly good message.
      if (!conversationId || !uid || (!text && !photo)) return;
      if (text.length > LIMITS.messageBody.max) return;
      // With no signal the write would sit queued and the send button
      // stay greyed out with her words gone. Refuse now; the chat
      // screen puts her draft back and says why.
      assertOnline();
      // Felt the moment she taps send, as on Instagram.
      hapticSend();

      const message = {
        conversationId,
        senderUid: uid,
        body: text,
        photo: photo ?? null,
        // A copy of the message she is answering. The rules check it
        // against the original, so it must come from replyFor().
        replyTo: replyTo ?? null,
        readBy: [uid],
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // The message and one tick of her hourly counter go in one batch
      // — the rules refuse a message that did not move the counter. If
      // the server disagrees about whether the hour is up (her phone's
      // clock is off), try the other way once.
      const first = quotaWrite(quotaRef.current, Date.now());
      try {
        await sendCounted(conversationId, uid, message, first);
      } catch {
        try {
          await sendCounted(conversationId, uid, message, otherQuotaWrite(first));
        } catch (err) {
          if ((quotaRef.current?.count ?? 0) >= LIMITS.messagesPerHour.max) {
            throw new Error(MESSAGE_QUOTA_FULL);
          }
          throw err;
        }
      }
      logEvent('message_sent', {
        surface: 'messages',
        targetType: null,
        targetId: conversationId,
      });
    },
    [conversationId, uid],
  );

  /**
   * Hearts or un-hearts one message. Only ever her own uid — the rules
   * refuse anything else. A failure is silent: the heart simply does
   * not appear, which is what she would see anyway.
   */
  const setLiked = useCallback(
    async (messageId: string, on: boolean) => {
      if (!conversationId || !uid) return;
      await updateDoc(doc(db, COLLECTIONS.conversations, conversationId, 'messages', messageId), {
        likedBy: on ? arrayUnion(uid) : arrayRemove(uid),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    },
    [conversationId, uid],
  );

  // If she deleted this thread once, only what came after shows — the
  // old history stays gone for her, as on Instagram.
  const visible = useMemo(
    () => messages.filter((m) => visibleAfterDelete(conversation, uid, m.createdAt)),
    [messages, conversation, uid],
  );

  return {
    conversation,
    messages: visible,
    loading,
    failed,
    retry,
    send,
    markRead,
    setLiked,
    receiptsOn,
    loadOlder,
    loadingOlder,
    olderError,
    hasOlder: !exhausted,
  };
}
