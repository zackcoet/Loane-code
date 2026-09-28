import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { COLLECTIONS, ids, type Conversation, type User, type UserSummary } from '@loane/shared';
import { db, now } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { assertNotBlocked } from '../moderation/block';

/**
 * `openConversation`
 *
 * Finds the thread between two students, creating it if this is the
 * first time.
 *
 * The id is the two uids sorted and joined, which means there is exactly
 * one thread per pair, forever. Messaging someone about a dress and the
 * chat a confirmed rental gets are the SAME conversation — a rental just
 * attaches its booking id to the thread they already have. Two people
 * should never have to wonder which of their chats the other one meant.
 *
 * It is a function rather than a write because both participants'
 * summaries and the unread counters have to be set correctly, and
 * because this is where blocking is enforced.
 */

interface OpenInput {
  /** The other student. */
  withUid: string;
  /** Optional context: the piece she is asking about. */
  listingId?: string;
  /** Optional context: the rental this thread is for. */
  bookingId?: string;
}

export function summarizeUser(user: User): UserSummary {
  return {
    uid: user.uid,
    username: user.username,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    campusId: user.campusId,
    isVerified: user.isVerified,
  };
}

export const openConversation = onCall<OpenInput, Promise<{ conversationId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<OpenInput>): Promise<{ conversationId: string }> => {
    const me = await requireVerifiedStudent(request);
    const { withUid, listingId, bookingId } = request.data ?? {};

    if (!withUid) throw invalidArgument('Who do you want to message?');
    if (withUid === me.uid) throw failed("You can't message yourself.");

    // Blocking is enforced here, not just hidden in the UI.
    await assertNotBlocked(me.uid, withUid);

    const themSnap = await db().collection(COLLECTIONS.users).doc(withUid).get();
    if (!themSnap.exists) throw notFound('We could not find that student.');
    const them = themSnap.data() as User;

    return { conversationId: await ensureConversation(me, them, { listingId, bookingId }) };
  },
);

/**
 * The thread between two students, created if it is not there yet.
 *
 * Shared with `sharePost`, which opens threads in bulk when a look is
 * sent to several people at once.
 */
export async function ensureConversation(
  me: User,
  them: User,
  context: { listingId?: string; bookingId?: string } = {},
): Promise<string> {
  const { listingId, bookingId } = context;
  const withUid = them.uid;
  const conversationId = ids.conversation(me.uid, withUid);
  const ref = db().collection(COLLECTIONS.conversations).doc(conversationId);

  await db().runTransaction(async (tx) => {
    const existing = await tx.get(ref);

    if (existing.exists) {
      // Keep the participant snapshots fresh, and attach the booking if
      // this is the first time the thread has had one.
      const patch: Record<string, unknown> = {
        [`participants.${me.uid}`]: summarizeUser(me),
        [`participants.${withUid}`]: summarizeUser(them),
        updatedAt: now(),
      };
      if (bookingId && !(existing.data() as Conversation).bookingId) {
        patch.bookingId = bookingId;
      }
      if (listingId && !(existing.data() as Conversation).listingId) {
        patch.listingId = listingId;
      }
      tx.update(ref, patch);
      return;
    }

    const conversation: Omit<Conversation, 'createdAt' | 'updatedAt'> = {
      id: conversationId,
      campusId: me.campusId,
      participantUids: [me.uid, withUid].sort(),
      participants: { [me.uid]: summarizeUser(me), [withUid]: summarizeUser(them) },
      listingId: listingId ?? null,
      bookingId: bookingId ?? null,
      lastMessage: null,
      unreadCounts: { [me.uid]: 0, [withUid]: 0 },
    };

    tx.set(ref, { ...conversation, createdAt: now(), updatedAt: now() });
  });

  return conversationId;
}
