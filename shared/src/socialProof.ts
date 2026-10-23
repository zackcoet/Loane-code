/**
 * The welcome screen's "Join 120+ girls at South Carolina" line.
 *
 * HIDDEN UNDER 50. "Join 7 girls" is anti-proof: it tells a stranger the
 * app is empty. Below the threshold the welcome screen says nothing at
 * all, which is the honest version of not having a number to brag about.
 *
 * ROUNDED DOWN, never up, to a tidy number with a "+": 127 shows as
 * "120+". The point is a feel for size, and a figure we can always back
 * up — `campuses/{id}.stats.userCount`, kept by createAccount and
 * deleteMyAccount, never by the phone.
 */

/** The only campus at launch. The welcome screen is shown before we know her school. */
export const LAUNCH_CAMPUS_ID = 'university-of-south-carolina';

/** Below this many students the line is not shown at all. */
export const SOCIAL_PROOF_MIN_USERS = 50;

/** 127 → 120, 1,342 → 1,300. Null when it should not be shown. */
export function socialProofCount(userCount: number | null | undefined): number | null {
  if (typeof userCount !== 'number' || !Number.isFinite(userCount)) return null;
  if (userCount < SOCIAL_PROOF_MIN_USERS) return null;
  const step = userCount >= 1000 ? 100 : 10;
  return Math.floor(userCount / step) * step;
}

/** "Join 120+ girls at South Carolina", or null when hidden. */
export function socialProofLine(
  userCount: number | null | undefined,
  campusShortName: string,
): string | null {
  const n = socialProofCount(userCount);
  if (n === null) return null;
  return `Join ${n.toLocaleString('en-US')}+ girls at ${campusShortName}`;
}
