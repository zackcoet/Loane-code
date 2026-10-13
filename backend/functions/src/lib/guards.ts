import type { CallableRequest } from 'firebase-functions/v2/https';
import type { User } from '@loane/shared';
import { COLLECTIONS, SUBCOLLECTIONS, type UserPrivate } from '@loane/shared';
import { db } from './admin';
import { failed, notFound, permissionDenied, unauthenticated } from './errors';
import { verificationRequired } from '../tryon/config';

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

  /*
    PROVEN, not merely claimed.

    `isVerified` means her domain is on the approved list, which is
    true from the moment she types the address. `emailConfirmed` means
    we sent a code there and she typed it back. Only the second one is
    evidence.

    Behind a flag so this cannot lock everybody out before email
    actually works — see verificationRequired().
  */
  if (!user.emailConfirmed && (await verificationRequired())) {
    throw permissionDenied('Confirm your school email to carry on.');
  }

  return user;
}

/**
 * A handoff is two students meeting in person. Both of them need a
 * face and a way to be reached.
 *
 * THE APP ASKS FOR THIS FIRST — see mobile useProfileGate, which puts
 * a sheet in front of Loane It and Put it on Loane. This is the same
 * rule enforced where it cannot be skipped. The app's version is for
 * her; this one is the actual rule.
 *
 * It is deliberately checked per ACTOR rather than per booking, so the
 * person who has to fix something is the person who is told. A renter
 * blocked by her lender's missing phone number gets an error she can
 * do nothing about.
 *
 * The phone lives on the private settings document, which is why this
 * costs a read the other guards do not.
 */
export async function requireHandoffReady(user: User, doing: string): Promise<void> {
  if (!user.photoUrl) {
    throw failed(`Add a profile photo before ${doing} — you'll be meeting in person.`);
  }

  const settings = await db()
    .collection(COLLECTIONS.users)
    .doc(user.uid)
    .collection(SUBCOLLECTIONS.userPrivate)
    .doc('settings')
    .get();

  const phone = (settings.data() as UserPrivate | undefined)?.phone;
  if (!phone) {
    throw failed(`Add your phone number before ${doing} — it's how the handoff gets arranged.`);
  }
}
