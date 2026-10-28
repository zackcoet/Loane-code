import type { AccountStatus, ListingStatus, PostStatus } from './constants';
import { DELETED_ACCOUNT_NAME, isDeletedAccount, isDeletedSummary } from './accountDeletion';

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

/** Why something of hers can't be put back, or a grant can't be given. */
export const DELETED_OWNER_REASON = 'Her account is deleted, so it cannot come back.';

/**
 * Can a taken-down listing, look or comment be put back, given who owns
 * it? Not once she has deleted her account (or her account is missing):
 * putting it back would show a "Deleted account" closet again, or bring
 * back words the Privacy Policy says go with her.
 *
 * Deletion already marks her things `removed`, which the restore checks
 * refuse on their own. This is the second lock: accounts deleted before
 * that sweep covered taken-down things, or a restore landing in the
 * same moment as her deletion, must not slip through.
 */
export function ownerRestoreBlockedReason(
  owner: { status: string } | null | undefined,
): string | null {
  if (!owner || owner.status === 'deactivated') return DELETED_OWNER_REASON;
  return null;
}

/**
 * Why the dashboard's take-down / put-back button on one listing or look
 * is greyed out, or null when it can be pressed. `owner` is her account
 * if the dashboard has it loaded; `undefined` means it doesn't (outside
 * the newest 250) and the server decides.
 */
export function moderationButtonBlockedReason(
  status: string,
  owner: { status: string } | undefined,
): string | null {
  if (status === 'removed') return 'Its owner already removed it.';
  if (status === 'suspended' && owner) return ownerRestoreBlockedReason(owner);
  return null;
}

/**
 * Can an admin give free try-ons to this account? Not a deleted one:
 * the grant would recreate her private settings, which deletion erased.
 */
export function grantBlockedReason(status: AccountStatus): string | null {
  return status === 'deactivated' ? 'That account is deleted.' : null;
}

/**
 * Can an admin mark (or unmark) this account as a Founding Closet — one
 * of the launch closets the dashboard's Founding Closets page tracks?
 * Taking a deleted account OFF is always fine (deletion already does
 * it); putting one ON would list an empty shell as a launch closet.
 * Admin accounts are not closets at all.
 */
export function foundingClosetBlockedReason(
  user: { status: string; role: string; deletedAt?: unknown; isFoundingCloset: boolean },
  on: boolean,
): string | null {
  if (!on) return user.isFoundingCloset ? null : 'She is not a Founding Closet.';
  if (user.isFoundingCloset) return 'She is already a Founding Closet.';
  if (user.status === 'deactivated') return 'That account is deleted.';
  if (user.role === 'admin') return 'Admin accounts are not closets.';
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

/**
 * The same label for a record that also keeps its own copy of her name
 * (a Contact us message). The live account wins whenever the dashboard
 * has it loaded, so a rename shows her name today; the copy is only the
 * fallback for an account outside the loaded list, marked "as sent" so
 * nobody mistakes a possibly old handle for her current one.
 */
export function personLabelWithCopy(
  uid: string | null | undefined,
  users: readonly { uid: string; username: string; status: string; deletedAt?: unknown }[],
  copy: { username: string } | null | undefined,
): ReportPersonLabel {
  const live = reportPersonLabel(uid, users);
  if (live.openUid || !uid || !copy) return live;
  if (isDeletedSummary(copy)) return { label: DELETED_ACCOUNT_NAME, openUid: null };
  return { label: `@${copy.username} (as sent)`, openUid: null };
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

/**
 * The dashboard's Activity Log in plain words.
 *
 * An audit row stores a code (`suspend_user`, `report_dismissed`,
 * `hide_post`) because the code is what never changes. Admins read
 * words, so the log translates them here. A code nobody has taught this
 * list yet is shown humanized rather than hidden: an audit log must
 * never drop a row just because it is new.
 */
const ADMIN_ACTION_LABELS: Record<string, string> = {
  suspend_user: 'Suspended her account',
  unsuspend_user: 'Lifted her suspension',
  add_admin_note: 'Added a private note',
  user_account_deleted: 'Deleted her account',
  user_data_exported: 'Exported her data',
  tryon_granted: 'Gave her extra try-ons',
  founding_closet_marked: 'Made her a Founding Closet',
  founding_closet_unmarked: 'Took her off Founding Closets',
  report_reviewing: 'Marked a report as being looked at',
  report_actioned: 'Acted on a report',
  report_dismissed: 'Dismissed a report',
  hide_listing: 'Took a piece down',
  restore_listing: 'Put a piece back',
  hide_post: 'Took a look down',
  restore_post: 'Put a look back',
  hide_comment: 'Hid a comment',
  restore_comment: 'Put a comment back',
  hide_review: 'Hid a review',
  restore_review: 'Put a review back',
  hide_message: 'Hid a message',
  resolve_dispute: 'Decided a rental dispute',
  resolve_support_request: 'Closed a Contact us message',
  publish_legal_doc: 'Published new Terms or Privacy',
  feature_flag_changed: 'Changed a feature switch',
};

export function adminActionLabel(action: string): string {
  const known = ADMIN_ACTION_LABELS[action];
  if (known) return known;
  const words = action.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Unknown action';
}

const ADMIN_TARGET_NAMES: Record<string, string> = {
  user: 'Student',
  listing: 'Piece',
  post: 'Look',
  booking: 'Rental',
  message: 'Message',
  comment: 'Comment',
  review: 'Review',
  campus: 'Campus',
  claim: 'Claim',
  report: 'Report',
  supportRequest: 'Contact us message',
  legalDoc: 'Terms / Privacy',
  config: 'Feature switches',
};

/**
 * What an audit row acted on, for anything that is not a student (a
 * student is shown by her current name with `reportPersonLabel`). Ids
 * are cut short: enough to search for, not a wall of characters. A
 * message's id is `conversationId/messageId`, so the short form keeps
 * the message part.
 */
export function adminTargetLabel(targetType: string, targetId: string): string {
  const name = ADMIN_TARGET_NAMES[targetType] ?? targetType;
  if (targetType === 'config' || !targetId) return name;
  if (targetType === 'legalDoc') return `${name} · ${targetId}`;
  const last = targetId.split('/').pop() ?? targetId;
  const short = last.length > 8 ? `${last.slice(0, 8)}…` : last;
  return `${name} · ${short}`;
}

/** Audit rows about one student, newest first. */
export function adminActionsAboutUser<T extends { targetType: string; targetId: string }>(
  actions: readonly T[],
  uid: string,
  time: (row: T) => number,
): T[] {
  return actions
    .filter((row) => row.targetType === 'user' && row.targetId === uid)
    .sort((a, b) => time(b) - time(a));
}

/**
 * The status a girl sees on her own past reports and Contact us messages
 * (Help → Past reports). The stored words are the admin's — "actioned",
 * "dismissed" — and "Dismissed" reads to the girl who reported something
 * as "we didn't believe you". Instagram says the report was received
 * and later that it was reviewed; this does the same.
 */
const MY_REPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Sent',
  reviewing: 'Being looked at',
  actioned: 'Handled',
  dismissed: 'Closed',
  resolved: 'Closed',
};

export function myReportStatusLabel(status: string): string {
  return MY_REPORT_STATUS_LABELS[status] ?? 'Sent';
}
