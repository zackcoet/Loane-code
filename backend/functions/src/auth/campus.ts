/**
 * Which campus does this email belong to?
 *
 * Lifted out of createAccount so that sign-up and "fix my email"
 * answer the question the same way. Two copies of this would drift,
 * and the way they would drift is one of them accepting an address
 * the other refuses — which looks, from the outside, like the app
 * being broken at random.
 *
 * AN UNKNOWN .edu IS NOT A REFUSAL. Any school that is not seeded
 * gets a campus built on the spot from its domain. Loane launches at
 * one university, but a student from another typing her real address
 * should land somewhere rather than be told no.
 */

import {
  COLLECTIONS,
  color,
  emailDomain,
  matchesCampusDomain,
  type Campus,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { invalidArgument } from '../lib/errors';

/** What she is told when the address is not a school one. */
export const EDU_MESSAGE = 'Use your .edu school email.';

export function isEduEmail(email: string): boolean {
  return emailDomain(email)?.endsWith('.edu') ?? false;
}

export async function campusForEmail(email: string): Promise<Campus> {
  const domain = emailDomain(email);
  if (!domain) throw invalidArgument('Enter a valid email address.');

  const campusSnap = await db().collection(COLLECTIONS.campuses).where('isLive', '==', true).get();
  const seeded = campusSnap.docs
    .map((d) => ({ ...(d.data() as Campus), id: d.id }))
    .find((c) => matchesCampusDomain(email, c.emailDomains));
  if (seeded) return seeded;

  const id = `school-${domain.replace(/[^a-z0-9]+/g, '-')}`;
  return {
    id,
    name: domain,
    shortName: domain,
    emailDomains: [domain],
    city: '',
    state: '',
    brandColor: color.campus.dotFallback,
    isLive: true,
    stats: {
      userCount: 0,
      verifiedUserCount: 0,
      listingCount: 0,
      postCount: 0,
      bookingCount: 0,
    },
    createdAt: now() as never,
    updatedAt: now() as never,
  };
}
