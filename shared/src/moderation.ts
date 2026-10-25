import type { AccountStatus, ListingStatus, PostStatus } from './constants';

/**
 * The rules for an admin taking a listing or a look down and putting it
 * back, in one place so the dashboard's buttons and a report's
 * "take it down" agree.
 *
 * WHY THIS EXISTS: putting something back used to always make it
 * `active`. A sold piece that was reported and taken down came back
 * rentable and buyable again; a look its owner had deleted came back
 * from the dead. Now the status it had is remembered when it comes down
 * (`statusBeforeSuspension`) and putting it back returns it there.
 */

/** Where a listing may come back to. Never 'removed' or 'suspended'. */
const LISTING_RESTORABLE: readonly ListingStatus[] = ['draft', 'active', 'paused', 'sold'];
/** Where a look may come back to. */
const POST_RESTORABLE: readonly PostStatus[] = ['active', 'scheduled'];

export type ModeratedKind = 'listing' | 'post';

/**
 * Can an admin take this down? Not if it's already down, and not if its
 * owner already removed it — there is nothing showing, and "restoring"
 * it later would undo her choice.
 */
export function takedownBlockedReason(status: string): string | null {
  if (status === 'suspended') return 'It is already down.';
  if (status === 'removed') return 'Its owner already removed it. There is nothing showing.';
  return null;
}

/**
 * The status to give it back. Anything missing or odd (taken down before
 * this field existed) falls back to `active`, which is what restoring
 * always did.
 */
export function statusAfterRestore(kind: 'listing', remembered: unknown): ListingStatus;
export function statusAfterRestore(kind: 'post', remembered: unknown): PostStatus;
export function statusAfterRestore(
  kind: ModeratedKind,
  remembered: unknown,
): ListingStatus | PostStatus {
  const allowed: readonly string[] = kind === 'listing' ? LISTING_RESTORABLE : POST_RESTORABLE;
  return typeof remembered === 'string' && allowed.includes(remembered)
    ? (remembered as ListingStatus | PostStatus)
    : 'active';
}

/**
 * Can an admin suspend this account? A deleted account cannot be: there
 * is nobody to suspend, and lifting the suspension later would turn a
 * "Deleted account" shell back into a live one.
 */
export function suspendBlockedReason(status: AccountStatus): string | null {
  if (status === 'suspended') return 'She is already suspended.';
  if (status === 'deactivated') return 'That account is deleted. There is nobody to suspend.';
  return null;
}
