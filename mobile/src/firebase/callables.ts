/**
 * Typed wrappers around our Cloud Functions.
 *
 * The app calls these instead of writing sensitive collections directly —
 * the security rules forbid those writes. See docs/security.md.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

/**
 * Creates the login, the profile and the username lock in one server-side
 * call, and returns a one-time token the app signs in with. The app never
 * creates a Firebase Auth account itself, so a login can never exist
 * without a Loane profile behind it.
 */
export const createAccount = httpsCallable<
  { firstName: string; email: string; password: string; username: string },
  { uid: string; username: string; campusId: string; token: string }
>(functions, 'createAccount');

export const checkCampusEmail = httpsCallable<
  { email: string },
  { allowed: boolean; campusName?: string; reason?: string }
>(functions, 'checkCampusEmail');

export const checkUsername = httpsCallable<
  { username: string },
  { available: boolean; reason?: string }
>(functions, 'checkUsername');

export const changeUsername = httpsCallable<{ username: string }, { username: string }>(
  functions,
  'changeUsername',
);

export const followUser = httpsCallable<{ uid: string }, { following: boolean }>(
  functions,
  'follow',
);

export const unfollowUser = httpsCallable<{ uid: string }, { following: boolean }>(
  functions,
  'unfollow',
);

export const requestBooking = httpsCallable<
  { listingId: string; startDate: string; endDate: string; message?: string },
  { bookingId: string; status: string }
>(functions, 'requestBooking');
