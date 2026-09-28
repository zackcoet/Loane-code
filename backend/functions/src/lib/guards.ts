import type { CallableRequest } from 'firebase-functions/v2/https';
import type { User } from '@loane/shared';
import { COLLECTIONS } from '@loane/shared';
import { db } from './admin';
import { notFound, permissionDenied, unauthenticated } from './errors';

/**
 * Checks every callable function runs before doing anything.
 *
 * Security rules protect direct database access. These protect the
 * functions, which bypass the rules.
 */

/** Returns the caller's uid, or throws. */
export function requireAuth(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw unauthenticated();
  return uid;
}

export function requireAdmin(request: CallableRequest): string {
  const uid = requireAuth(request);
  if (request.auth?.token?.admin !== true) throw permissionDenied();
  return uid;
}

/** Loads the caller's user document and checks the account is in good standing. */
export async function requireActiveUser(request: CallableRequest): Promise<User> {
  const uid = requireAuth(request);
  const snap = await db().collection(COLLECTIONS.users).doc(uid).get();
  if (!snap.exists) throw notFound('We could not find your account.');

  const user = snap.data() as User;
  if (user.status === 'suspended') {
    throw permissionDenied('Your account is suspended. Contact team@joinloane.com.');
  }
  if (user.status === 'deactivated') {
    throw permissionDenied('This account is deactivated.');
  }
  return user;
}

/**
 * Requires a campus-verified student.
 *
 * NOTE: at MVP `isVerified` is true as soon as someone types a matching
 * campus email — we do not yet send a confirmation. This guard is wired up
 * so that turning on real verification changes nothing but the verification
 * function itself. See docs/security.md.
 */
export async function requireVerifiedStudent(request: CallableRequest): Promise<User> {
  const user = await requireActiveUser(request);
  if (!user.isVerified) {
    throw permissionDenied('Verify your campus email first.');
  }
  return user;
}
