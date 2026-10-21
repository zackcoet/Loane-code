import type { BookingStatus } from './constants';
import type { UserSummary } from './types';

/**
 * Deleting an account — the pieces the app and the server must agree on.
 *
 * Apple requires in-app account deletion (guideline 5.1.1(v)). What it
 * means for Loane is set by Privacy Policy v1 §5–6 and Terms v1 §3:
 *
 *   - Open rentals must be finished or cancelled first.
 *   - Her personal information is deleted or anonymized.
 *   - Rental, payment and claim records are kept (up to 7 years).
 *   - Reviews she left may stay, shown without her name.
 *
 * So the user document is NOT deleted. It is emptied down to a
 * "Deleted account" shell, because bookings and reviews point at her uid
 * and a dangling uid would break somebody else's rental history.
 */

/** What every copy of her name becomes. */
export const DELETED_ACCOUNT_NAME = 'Deleted account';

/**
 * Her handle after deletion. Unique per account so two deleted accounts
 * never answer to the same `/u/` link, and starting with a word the
 * signup screen already refuses so nobody can register it.
 */
export const DELETED_USERNAME_PREFIX = 'deleted_';

export function deletedUsername(uid: string): string {
  return `${DELETED_USERNAME_PREFIX}${uid.slice(0, 10).toLowerCase()}`;
}

/** The summary written over every copy of her profile. */
export function deletedUserSummary(uid: string, campusId: string): UserSummary {
  return {
    uid,
    username: deletedUsername(uid),
    displayName: DELETED_ACCOUNT_NAME,
    photoUrl: null,
    campusId,
    isVerified: false,
  };
}

/**
 * True for a stored copy of a deleted account's profile — a chat's
 * participant, a comment's author. Copies carry no status, so the
 * handle is the tell; nobody can register one (see validateUsername).
 */
export function isDeletedSummary(summary: { username: string } | null | undefined): boolean {
  return !!summary && summary.username.startsWith(DELETED_USERNAME_PREFIX);
}

/** True for an account that has been deleted and is now only a shell. */
export function isDeletedAccount(user: { status: string; deletedAt?: unknown }): boolean {
  return user.status === 'deactivated' && user.deletedAt != null;
}

/**
 * Rentals that stop her deleting.
 *
 * Anything where a garment is spoken for, out, on its way back, or under
 * a claim. `disputed` is listed even though the booking machine calls it
 * terminal: a claim is still being decided, and the other student needs
 * someone on the other end of it.
 */
export const BOOKING_STATUSES_BLOCKING_DELETION: readonly BookingStatus[] = [
  'requested',
  'confirmed',
  'with_renter',
  'returned',
  'disputed',
];

export function blocksAccountDeletion(status: BookingStatus): boolean {
  return BOOKING_STATUSES_BLOCKING_DELETION.includes(status);
}

/** What she is told when open rentals stop her. */
export function accountDeletionBlockedMessage(openRentals: number): string {
  const rentals = openRentals === 1 ? 'a rental' : `${openRentals} rentals`;
  return `You have ${rentals} still going. Finish or cancel ${
    openRentals === 1 ? 'it' : 'them'
  } in My Rentals, then you can delete your account.`;
}

/**
 * How recently she must have typed her password.
 *
 * Deleting is permanent, so a phone left unlocked on a desk is not
 * enough. The app asks for her password and signs in again right
 * before calling; the server checks the sign-in really is that fresh.
 */
export const ACCOUNT_DELETION_RECENT_SIGN_IN_SECONDS = 5 * 60;

export function signedInRecently(authTimeSeconds: number | undefined, nowMs: number): boolean {
  if (typeof authTimeSeconds !== 'number' || !Number.isFinite(authTimeSeconds)) return false;
  const ageSeconds = nowMs / 1000 - authTimeSeconds;
  // A little slack for clock drift between the phone's sign-in and us.
  return ageSeconds >= -60 && ageSeconds <= ACCOUNT_DELETION_RECENT_SIGN_IN_SECONDS;
}
