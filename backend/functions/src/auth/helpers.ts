import type { CallableRequest } from 'firebase-functions/v2/https';

export { alreadyTaken, failed, invalidArgument, notFound, permissionDenied } from '../lib/errors';
import { unauthenticated } from '../lib/errors';

/**
 * Signup runs before a user profile exists, so it cannot use the normal
 * `requireActiveUser` guard — it only needs a Firebase Auth account.
 */
export function requireAuthOrThrow(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw unauthenticated();
  return uid;
}
