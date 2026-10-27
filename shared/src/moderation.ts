import type { AccountStatus, ListingStatus, PostStatus } from './constants';
import { DELETED_ACCOUNT_NAME, isDeletedAccount } from './accountDeletion';

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

/**
 * What a finished sale writes on the piece.
 *
 * A sale takes the piece off the market (`sold`). But if an admin took
 * the piece down while the sale was going through, writing `sold`
 * straight onto it would quietly put a reported piece back up on her
 * closet. So a taken-down piece stays down, and `sold` becomes what it
 * returns to if it is ever put back.
 */
export function listingFieldsOnSale(
  current: unknown,
): { status: 'sold' } | { statusBeforeSuspension: 'sold' } {
  return current === 'suspended' ? { statusBeforeSuspension: 'sold' } : { status: 'sold' };
}

/**
 * Who a report is about, or who filed it, as the dashboard shows it.
 *
 * WHY THIS EXISTS: the reports queue showed only "post" or "message" —
 * never WHO — so "Warn her" and "Suspend her" acted on a girl the admin
 * could not see. A report keeps only her account id (`targetUid`,
 * `reporterUid`), never a copy of her name, so the name is looked up
 * fresh each time: after a rename it shows her current @username, and
 * after deletion it says so rather than an old handle someone else may
 * since have taken.
 *
 * `openUid` is set only when the dashboard has her loaded and she can
 * be opened; a deleted account still opens (its page explains what is
 * left), an account outside the loaded list does not.
 */
export interface ReportPersonLabel {
  label: string;
  openUid: string | null;
}

export function reportPersonLabel(
  uid: string | null | undefined,
  users: readonly { uid: string; username: string; status: string; deletedAt?: unknown }[],
  autoFilterUid?: string,
): ReportPersonLabel {
  if (!uid) return { label: 'Nobody named', openUid: null };
  if (autoFilterUid && uid === autoFilterUid) return { label: 'Automatic filter', openUid: null };
  const user = users.find((candidate) => candidate.uid === uid);
  if (!user) return { label: `Account ${uid.slice(0, 8)}… (not loaded)`, openUid: null };
  if (isDeletedAccount(user)) return { label: DELETED_ACCOUNT_NAME, openUid: uid };
  const suffix = user.status === 'suspended' ? ' (suspended)' : '';
  return { label: `@${user.username}${suffix}`, openUid: uid };
}

/** Reports about one girl, open ones first, otherwise in the order given (newest first). */
export function reportsAboutUser<T extends { targetUid: string | null; status: string }>(
  reports: readonly T[],
  uid: string,
): T[] {
  const open = (report: T) => report.status === 'open' || report.status === 'reviewing';
  return reports
    .filter((report) => report.targetUid === uid)
    .sort((a, b) => Number(open(b)) - Number(open(a)));
}
