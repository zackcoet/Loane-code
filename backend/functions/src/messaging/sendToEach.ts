import { COLLECTIONS, SUBCOLLECTIONS, type Message, type User } from '@loane/shared';
import { db, now } from '../lib/admin';
import { isBlockedEitherWay } from '../moderation/block';
import { ensureConversation } from './openConversation';

/**
 * Drops one message into the thread with each of several people,
 * starting the thread where there is none yet.
 *
 * Shared by `sharePost`, `shareListing` and `shareProfile`, which differ
 * only in what goes in the bubble.
 *
 * Anyone she cannot message is SKIPPED rather than failing the whole
 * send. Sending to five friends and getting an error because one of
 * them blocked her would tell her something about that person that she
 * is not entitled to know.
 */
export async function sendToEach(
  me: User,
  toUids: string[],
  content: Pick<Message, 'body' | 'sharedPost' | 'sharedListing' | 'sharedProfile'>,
): Promise<{ sentTo: number; lastConversationId: string | null }> {
  let sentTo = 0;
  let lastConversationId: string | null = null;

  for (const uid of toUids) {
    const themSnap = await db().collection(COLLECTIONS.users).doc(uid).get();
    if (!themSnap.exists) continue;
    const them = themSnap.data() as User;
    if (them.status !== 'active') continue;
    if (await isBlockedEitherWay(me.uid, uid)) continue;

    const conversationId = await ensureConversation(me, them);
    const message: Omit<Message, 'createdAt' | 'updatedAt'> = {
      id: '',
      conversationId,
      senderUid: me.uid,
      body: content.body,
      photo: null,
      sharedPost: content.sharedPost,
      sharedListing: content.sharedListing ?? null,
      sharedProfile: content.sharedProfile ?? null,
      replyTo: null,
      readBy: [me.uid],
      isDeleted: false,
    };

    const ref = db()
      .collection(COLLECTIONS.conversations)
      .doc(conversationId)
      .collection(SUBCOLLECTIONS.messages)
      .doc();
    // onMessageCreated picks it up from here and moves the thread
    // preview and the other person's unread badge.
    await ref.set({ ...message, id: ref.id, createdAt: now(), updatedAt: now() });

    sentTo += 1;
    lastConversationId = conversationId;
  }

  return { sentTo, lastConversationId };
}

/**
 * Her recipients, cleaned: deduplicated, and never herself — a look in
 * her own chat with herself is not a thing.
 */
export function cleanRecipients(raw: unknown, myUid: string): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(raw.filter((u): u is string => typeof u === 'string' && u !== '')),
  ).filter((u) => u !== myUid);
}
