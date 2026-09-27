import {
  BOOKING_TRANSITIONS,
  COLLECTIONS,
  type Booking,
  type BookingStatus,
  type NotificationType,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { failed, notFound, permissionDenied } from '../lib/errors';
import type { Transaction } from 'firebase-admin/firestore';

/**
 * The one place a booking's status is allowed to change.
 *
 * Every booking function goes through here, so "can the renter mark her
 * own booking confirmed?" has exactly one answer in exactly one place —
 * the table in shared/src/constants.ts. Spreading that logic across six
 * functions is how state machines quietly grow holes.
 */

export type Actor = 'lender' | 'renter' | 'system';

export interface TransitionContext {
  booking: Booking;
  actor: Actor;
}

/** Throws unless this actor may move this booking to this status. */
export function assertCanTransition(
  booking: Booking,
  to: BookingStatus,
  actor: Actor,
): void {
  const allowed = BOOKING_TRANSITIONS[booking.status] ?? [];
  const match = allowed.find(
    (t) => t.to === to && (t.by === actor || t.by === 'either' || actor === 'system'),
  );

  if (!match) {
    // Two different failures, and the difference matters to the person
    // reading the message.
    const reachable = allowed.some((t) => t.to === to);
    throw reachable
      ? permissionDenied("You can't make that change on this rental.")
      : failed(`This rental is ${booking.status.replace('_', ' ')}, so that isn't possible.`);
  }
}

/** Loads a booking and works out which side the caller is on. */
export async function loadBookingFor(
  bookingId: string,
  uid: string,
  tx?: Transaction,
): Promise<{ booking: Booking; actor: Exclude<Actor, 'system'>; ref: FirebaseFirestore.DocumentReference }> {
  const ref = db().collection(COLLECTIONS.bookings).doc(bookingId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) throw notFound('We could not find that rental.');

  const booking = snap.data() as Booking;
  if (booking.lenderUid === uid) return { booking, actor: 'lender', ref };
  if (booking.renterUid === uid) return { booking, actor: 'renter', ref };

  throw permissionDenied('That rental is not yours.');
}

/**
 * Writes an in-app alert for one side of a booking.
 *
 * These are what the Activity tab shows. Push notifications are Phase 6;
 * a student still needs to know her dress was accepted before then.
 */
interface Writer {
  set(ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData): unknown;
}

export function notify(
  /** A Transaction or a WriteBatch — both can set a document. */
  tx: Writer,
  params: {
    uid: string;
    type: NotificationType;
    title: string;
    body: string;
    bookingId: string;
    actor?: { uid: string; username: string; photoUrl: string | null };
  },
): void {
  const ref = db()
    .collection(COLLECTIONS.users)
    .doc(params.uid)
    .collection('notifications')
    .doc();

  tx.set(ref, {
    id: ref.id,
    uid: params.uid,
    type: params.type,
    title: params.title,
    body: params.body,
    actorUid: params.actor?.uid ?? null,
    actorUsername: params.actor?.username ?? null,
    actorPhotoUrl: params.actor?.photoUrl ?? null,
    deepLink: `/rental/${params.bookingId}`,
    refs: { bookingId: params.bookingId },
    readAt: null,
    pushSentAt: null,
    createdAt: now(),
    updatedAt: now(),
  });
}

/** The other side of a booking, for addressing a notification. */
export function otherSide(booking: Booking, actor: Actor): string {
  return actor === 'lender' ? booking.renterUid : booking.lenderUid;
}

/** A short label for a piece, used in notification copy. */
export function pieceName(booking: Booking): string {
  return booking.listing?.name ?? 'a piece';
}
