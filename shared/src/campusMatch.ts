import { emailDomain } from './validation';

/**
 * Which school an email belongs to.
 *
 * WHY THIS EXISTS: many schools hand out more than one kind of address —
 * `clemson.edu` and `g.clemson.edu`, say. Sign-up used to match a
 * school's domains exactly, so the first girl on `g.clemson.edu` got a
 * campus of her own, apart from everyone on `clemson.edu`: an empty
 * feed, an empty Discover, nobody to rent from. Now:
 *
 *   1. An exact match wins (USC lists `sc.edu` and `email.sc.edu`).
 *   2. Otherwise a sub-address of a school's domain joins that school
 *      (`mailbox.sc.edu` → USC, `g.clemson.edu` → Clemson).
 *   3. Otherwise she is the first from her school, and the new campus is
 *      named after the school's own domain (`clemson.edu`), never the
 *      sub-address, so everyone after her finds it by rule 1 or 2.
 */

/** The school's own domain: the last two parts, `g.clemson.edu` → `clemson.edu`. */
export function schoolDomain(domain: string): string {
  const parts = domain.toLowerCase().split('.').filter(Boolean);
  return parts.slice(-2).join('.');
}

/** The campus this email belongs to, or null if none of these match. */
export function findCampusForEmail<C extends { emailDomains: string[] }>(
  email: string,
  campuses: readonly C[],
): C | null {
  const domain = emailDomain(email);
  if (!domain) return null;
  const listed = (c: C) => c.emailDomains.map((d) => d.toLowerCase());
  return (
    campuses.find((c) => listed(c).includes(domain)) ??
    campuses.find((c) => listed(c).some((d) => domain.endsWith(`.${d}`))) ??
    null
  );
}

/** The id a newly made campus gets, from the school's own domain. */
export function newCampusId(domain: string): string {
  return `school-${schoolDomain(domain).replace(/[^a-z0-9]+/g, '-')}`;
}
