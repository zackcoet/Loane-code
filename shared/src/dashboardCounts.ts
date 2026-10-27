/**
 * What the admin dashboard counts as a student, a piece and a look.
 *
 * WHY THIS EXISTS. The Overview headlines used to count every document
 * the dashboard loaded: the admin's own account was a "user", a deleted
 * account's empty shell was a "user", and a piece or look she had
 * removed (they are kept, marked removed, because rentals and tags point
 * at them) still counted as "Listings" and "Posts". The numbers only
 * ever went up. These rules make "how many are on Loane right now" mean
 * exactly that, in one place, so the Overview and the Campuses page
 * cannot disagree.
 *
 * Sign-ups are different: a girl who signed up and later deleted her
 * account DID sign up, so sign-up counts and the funnel keep her
 * (`isStudentAccount`), and only the "right now" totals drop her
 * (`isCurrentStudent`).
 */

import type { ListingStatus, PostStatus } from './constants';
import type { User } from './types/user';

/**
 * A student's account, deleted or not. Admin accounts are staff, never
 * sign-ups. Accounts from before roles existed count as students.
 */
export function isStudentAccount(user: Pick<User, 'role'>): boolean {
  return (user.role ?? 'student') === 'student';
}

/**
 * A student who still has an account. Suspended girls still count —
 * they are still members, just paused; deleted accounts do not.
 */
export function isCurrentStudent(user: Pick<User, 'role' | 'status'>): boolean {
  return isStudentAccount(user) && user.status !== 'deactivated';
}

/**
 * Pieces that are on someone's closet right now: up for rent or sale,
 * paused by her, or sold (a sold piece still shows on her profile).
 * Not drafts, not ones she removed, not ones an admin took down.
 */
export const DASHBOARD_LISTING_STATUSES = [
  'active',
  'paused',
  'sold',
] as const satisfies readonly ListingStatus[];

/** Looks anyone can see right now: not scheduled, removed or taken down. */
export const DASHBOARD_POST_STATUSES = ['active'] as const satisfies readonly PostStatus[];

export function isCountedListing(listing: { status: ListingStatus }): boolean {
  return (DASHBOARD_LISTING_STATUSES as readonly ListingStatus[]).includes(listing.status);
}

export function isCountedPost(post: { status: PostStatus }): boolean {
  return (DASHBOARD_POST_STATUSES as readonly PostStatus[]).includes(post.status);
}
