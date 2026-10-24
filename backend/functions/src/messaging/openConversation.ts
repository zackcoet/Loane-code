import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  ids,
  type Booking,
  type Conversation,
  type Listing,
  type User,
  type UserSummary,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { rateLimit } from '../lib/rateLimit';
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
    await rateLimit(me.uid, 'conversation');
    const { withUid, listingId, bookingId } = request.data ?? {};

    if (typeof withUid !== 'string' || withUid === '') {
      throw invalidArgument('Who do you want to message?');
    }
    if (withUid === me.uid) throw failed("You can't message yourself.");

    // Blocking is enforced here, not just hidden in the UI.
    await assertNotBlocked(me.uid, withUid);

    const themSnap = await db().collection(COLLECTIONS.users).doc(withUid).get();
    if (!themSnap.exists) throw notFound('We could not find that student.');
    const them = themSnap.data() as User;

    /*
      Nobody starts a NEW chat with a deleted or suspended account — the
      same rule as following. A deleted one is a "Deleted account" shell
      that will never read it.

      But a thread they already had stays openable: a renter whose lender
      was suspended mid-rental still needs to scroll back to where they
      agreed to meet. It is returned as it is, untouched.
    */
    if (them.status !== 'active') {
      const id = ids.conversation(me.uid, withUid);
      const existing = await db().collection(COLLECTIONS.conversations).doc(id).get();
      if (existing.exists) return { conversationId: id };
      throw notFound('We could not find that student.');
    }

    const context = await checkedContext(me.uid, withUid, { listingId, bookingId });
    return { conversationId: await ensureConversation(me, them, context) };
  },
);

/**
 * The piece or rental she says the chat is about — kept only if it is
 * really about these two people.
 *
 * Never trust the phone: without this, anyone could pin somebody else's
 * rental or a stranger's piece onto a thread. Something that doesn't
 * check out is DROPPED, not refused — the chat itself is fine, and a
 * stale screen shouldn't stop her messaging someone.
 */
async function checkedContext(
  myUid: string,
  withUid: string,
  raw: { listingId?: unknown; bookingId?: unknown },
): Promise<{ listingId?: string; bookingId?: string }> {
  const pair = [myUid, withUid];
  const out: { listingId?: string; bookingId?: string } = {};

  if (typeof raw.listingId === 'string' && raw.listingId !== '') {
    const snap = await db().collection(COLLECTIONS.listings).doc(raw.listingId).get();
    const listing = snap.data() as Listing | undefined;
    if (listing && pair.includes(listing.ownerUid)) out.listingId = raw.listingId;
    else logger.warn('Chat context dropped', { kind: 'listing', id: raw.listingId });
  }

  if (typeof raw.bookingId === 'string' && raw.bookingId !== '') {
    const snap = await db().collection(COLLECTIONS.bookings).doc(raw.bookingId).get();
    const booking = snap.data() as Booking | undefined;
    const sameTwo =
      booking &&
      pair.includes(booking.lenderUid) &&
      pair.includes(booking.renterUid) &&
      booking.lenderUid !== booking.renterUid;
    if (sameTwo) out.bookingId = raw.bookingId;
    else logger.warn('Chat context dropped', { kind: 'booking', id: raw.bookingId });
  }

  return out;
}

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
