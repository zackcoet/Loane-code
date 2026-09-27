/**
 * Messaging.
 *
 * Messages are written straight to Firestore by the app and arrive over
 * a realtime listener, so a chat feels like a chat. A trigger tidies up
 * the thread's preview and unread badge a moment later — see
 * onMessageCreated for why that is not a callable.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
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
import { COLLECTIONS, LIMITS, type Conversation, type ImageRef, type Message } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { logEvent } from '../analytics/events';

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

/** Total unread across every thread, for the inbox badge. */
export function useUnreadMessageCount(): number {
  const { profile } = useAuth();
  const { conversations } = useConversations();
  const uid = profile?.uid;
  if (!uid) return 0;
  return conversations.reduce((total, c) => total + (c.unreadCounts?.[uid] ?? 0), 0);
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
        setConversation(
          snap.exists() ? { ...(snap.data() as Conversation), id: snap.id } : null,
        ),
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

  /** Clears her own badge. The rules allow only her own key. */
  const markRead = useCallback(async () => {
    if (!conversationId || !uid) return;
    if (!conversation || (conversation.unreadCounts?.[uid] ?? 0) === 0) return;
    await updateDoc(doc(db, COLLECTIONS.conversations, conversationId), {
      [`unreadCounts.${uid}`]: 0,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, [conversationId, uid, conversation]);

  const send = useCallback(
    async (body: string, photo?: ImageRef) => {
      const text = body.trim();
      // A photo on its own is a perfectly good message.
      if (!conversationId || !uid || (!text && !photo)) return;
      if (text.length > LIMITS.messageBody.max) return;

      await addDoc(collection(db, COLLECTIONS.conversations, conversationId, 'messages'), {
        conversationId,
        senderUid: uid,
        body: text,
        photo: photo ?? null,
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

  return { conversation, messages, loading, send, markRead };
}
