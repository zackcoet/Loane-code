/**
 * Typed wrappers around our Cloud Functions.
 *
 * The app calls these instead of writing sensitive collections directly —
 * the security rules forbid those writes outright. See docs/security.md.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

export const completeSignup = httpsCallable<
  { firstName: string; campusEmail: string; username: string },
  { uid: string; username: string; campusId: string; isVerified: boolean }
>(functions, 'completeSignup');

export const checkUsername = httpsCallable<
  { username: string },
  { available: boolean; reason?: string }
>(functions, 'checkUsername');

export const requestBooking = httpsCallable<
  { listingId: string; startDate: string; endDate: string; message?: string },
  { bookingId: string; status: string }
>(functions, 'requestBooking');
