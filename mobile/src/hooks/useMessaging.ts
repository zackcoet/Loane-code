/**
 * Messaging.
 *
 * Messages are written straight to Firestore by the app and arrive over
 * a realtime listener, so a chat feels like a chat. A trigger tidies up
 * the thread's preview and unread badge a moment later — see
 * onMessageCreated for why that is not a callable.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
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
import {
  COLLECTIONS,
  LIMITS,
  inboxUnreadTotal,
  needsMarkRead,
  splitInbox,
  visibleAfterDelete,
  type Conversation,
  type ImageRef,
  type Message,
  type MessageReply,
} from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { logEvent } from '../analytics/events';
import { useFollowingUids } from './useFollowing';

/** Her inbox, most recent first. */
export function useConversations() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.conversations),
        where('participantUids', 'array-contains', uid),
        orderBy('updatedAt', 'desc'),
        limit(50),
      ),
      (snap) => {
        setConversations(snap.docs.map((d) => ({ ...(d.data() as Conversation), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);

  return { conversations, loading };
}

/**
 * Her inbox split the way the screen shows it: the threads she reads,
 * and the message requests from people she does not follow. Deleted
 * threads are in neither until something new arrives.
 */
export function useInbox() {
  const { profile } = useAuth();
  const uid = profile?.uid;
  const { conversations, loading } = useConversations();
  const { uids: following, loading: followingLoading } = useFollowingUids();
  const split = useMemo(
    () => (uid ? splitInbox(conversations, uid, following) : { inbox: [], requests: [] }),
    [conversations, uid, following],
  );
  // Wait for who she follows too, or a friend's thread would flash in
  // Requests for a moment on every open.
  return { ...split, loading: loading || followingLoading };
}

/**
 * Total unread for the Messages badge. Muted threads, deleted threads
 * and requests do not count — see inboxUnreadTotal.
 */
export function useUnreadMessageCount(): number {
  const { profile } = useAuth();
  const { conversations } = useConversations();
  const { uids: following } = useFollowingUids();
  const uid = profile?.uid;
  if (!uid) return 0;
  return inboxUnreadTotal(conversations, uid, following);
}

/**
 * Deletes a thread from HER inbox only. The other person keeps it, and
 * it comes back for her when someone sends something new. Clears her
 * badge too — a deleted thread should not leave a number behind.
 */
export async function deleteThreadForMe(conversationId: string, uid: string): Promise<void> {
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
  await updateDoc(doc(db, COLLECTIONS.conversations, conversationId), {
    mutedUids: muted ? arrayUnion(uid) : arrayRemove(uid),
  });
}

/** One thread: its messages, and how to send. */
export function useConversation(conversationId: string | undefined) {
  const { profile } = useAuth();
  const uid = profile?.uid;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, COLLECTIONS.conversations, conversationId),
      (snap) =>
        setConversation(snap.exists() ? { ...(snap.data() as Conversation), id: snap.id } : null),
      () => setConversation(null),
    );
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.conversations, conversationId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
      (snap) => {
        setMessages(snap.docs.map((d) => ({ ...(d.data() as Message), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [conversationId]);

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
    if (!needsMarkRead(conversation, messages, uid)) return;
    await updateDoc(doc(db, COLLECTIONS.conversations, conversationId), {
      [`unreadCounts.${uid}`]: 0,
      [`lastReadAt.${uid}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, [conversationId, uid, conversation, messages]);

  const send = useCallback(
    async (body: string, photo?: ImageRef, replyTo?: MessageReply | null) => {
      const text = body.trim();
      // A photo on its own is a perfectly good message.
      if (!conversationId || !uid || (!text && !photo)) return;
      if (text.length > LIMITS.messageBody.max) return;

      await addDoc(collection(db, COLLECTIONS.conversations, conversationId, 'messages'), {
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
      });
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

  return { conversation, messages: visible, loading, send, markRead, setLiked };
}
