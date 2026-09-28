import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Error helpers.
 *
 * Messages here are shown to the user, so they must be plain English and
 * must never leak internal detail (uids, document ids, stack traces).
 */

export const unauthenticated = (message = 'Sign in to continue.') =>
  new HttpsError('unauthenticated', message);

export const permissionDenied = (message = "You can't do that.") =>
  new HttpsError('permission-denied', message);

export const invalidArgument = (message: string) => new HttpsError('invalid-argument', message);

export const notFound = (message: string) => new HttpsError('not-found', message);

/** Used when someone else got there first — e.g. a username or rental dates. */
export const alreadyTaken = (message: string) => new HttpsError('already-exists', message);

export const failed = (message: string) => new HttpsError('failed-precondition', message);

export const internal = (message = 'Something went wrong. Try again.') =>
  new HttpsError('internal', message);
