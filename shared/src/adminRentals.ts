import type { BookingStatus } from './constants';
import { isDeletedAccount } from './accountDeletion';

/**
 * The dashboard's Rentals page and a student's own page.
 *
 * A booking keeps a copy of each girl's name from the day it was made
 * (and, since run 58, a still-going one follows a rename). The dashboard
 * needs to find a rental by who she is TODAY, so search looks at both the
 * copy and the live account. A deleted girl's live account says nothing
 * about her any more, so it is never searched by her old name.
 */

type PersonCopy = { username: string; displayName: string };
type LiveUser = {
  uid: string;
  username: string;
  displayName: string;
  status: string;
  deletedAt?: unknown;
};
type SearchableBooking = {
  status: BookingStatus;
  listing: { name: string };
  lenderUid: string;
  lender: PersonCopy;
  renterUid: string;
  renter: PersonCopy;
};

function personText(uid: string, copy: PersonCopy, users: ReadonlyMap<string, LiveUser>): string {
  const live = users.get(uid);
  const liveText = live && !isDeletedAccount(live) ? `${live.username} ${live.displayName}` : '';
  return `${copy.username} ${copy.displayName} ${liveText}`;
}

/** True when the rental's piece or either girl (copy or live) matches. Empty query matches all. */
export function bookingMatchesSearch(
  booking: SearchableBooking,
  users: ReadonlyMap<string, LiveUser>,
  query: string,
): boolean {
  const q = query.trim().replace(/^@/, '').toLowerCase();
  if (!q) return true;
  const text = [
    booking.listing.name,
    personText(booking.lenderUid, booking.lender, users),
    personText(booking.renterUid, booking.renter, users),
  ]
    .join(' ')
    .toLowerCase();
  return text.includes(q);
}

/**
 * Her rentals and sales on both sides, for her dashboard page, open
 * disputes first and otherwise in the order given (newest first). The
 * same name turning up in several disputes is the signal an admin needs,
 * and before this the only way to see it was scrolling every rental.
 */
export function bookingsForUser<T extends SearchableBooking>(
  bookings: readonly T[],
  uid: string,
): { booking: T; side: 'lender' | 'renter' }[] {
  const mine = bookings
    .filter((booking) => booking.lenderUid === uid || booking.renterUid === uid)
    .map((booking) => ({
      booking,
      side: booking.lenderUid === uid ? ('lender' as const) : ('renter' as const),
    }));
  return [
    ...mine.filter((row) => row.booking.status === 'disputed'),
    ...mine.filter((row) => row.booking.status !== 'disputed'),
  ];
}
