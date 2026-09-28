/**
 * Loane Cloud Functions.
 *
 * Anything involving money, bookings, trust, verification or counting lives
 * here rather than in the app, because the app cannot be trusted. See
 * docs/security.md.
 *
 * Built and working today:
 *   - createAccount      the whole signup server-side: checks the school
 *                        domain, creates the login, writes the profile and
 *                        claims the username, or leaves nothing behind
 *   - checkCampusEmail   "is Loane at my school?" as she types
 *   - checkUsername      "is this taken?" for the claim-username screen
 *   - changeUsername     swaps her handle in one transaction
 *   - follow / unfollow  the only way follower counts ever move
 *   - save / unsave      the only way a listing's save count ever moves
 *   - removeListing      hides a listing, never deletes it, and refuses
 *                        while a rental is in flight
 *   - createPost         validates tags, derives the flattened ids and
 *                        moves tagCount — all in one write
 *   - deletePost         soft delete, handing back the tag counts
 *   - likePost / savePost and their undos
 *   - requestBooking     the double-booking-proof rental request
 *   - respondToBooking   accept or decline, re-checking for conflicts
 *   - recordDropoff / confirmReceipt / confirmReturn   the handoff
 *   - flagReturnProblem  the lender's 48-hour window to report a problem
 *   - cancelBooking      either side, before the garment changes hands
 *   - setBlockedDates    the lender's own unavailable days
 *   - openConversation   the one thread between two students
 *   - sharePost          sends a look into one or more chats
 *   - addComment / deleteComment   comments on a look, and taking one down
 *   - writeReview        only from someone who actually rented with you
 *   - submitReport       flags a user, listing, post or rental for admins
 *   - blockUser          refuses messaging, renting and following both ways
 *
 * Admin only, every one of which writes an audit row in the same commit:
 *   - suspendUser / unsuspendUser / addAdminNote
 *   - hideListing / hidePost / hideReview / hideComment and their restores
 *   - resolveReport      can hide content and suspend in the same call
 *   - resolveDispute     decides a flagged return
 *
 * Background triggers:
 *   - countListingView          moves a listing's view count
 *   - countPostEngagement       moves a post's view and tag-tap counts
 *   - refreshTagLabels          keeps tag labels in step with the listing
 *   - syncListingAvailability   publishes booked dates onto the listing so
 *                               renters can see them without reading
 *                               other people's bookings
 *   - onMessageCreated          updates a thread's preview and unread badge
 *   - propagateProfileChanges   refreshes the copies of her profile stored
 *                               on her listings and posts
 *
 * Skeletons with TODOs, filled in during later phases:
 *   - social counters  (Phase 3)
 *   - booking lifecycle: accept, decline, handoff, return (Phase 4)
 *   - payments, payouts, protection holds, damage claims (Phase 5)
 *   - reviews, reports, push notifications (Phase 6)
 */

export { createAccount, checkCampusEmail } from './auth/createAccount';
export { checkUsername } from './auth/checkUsername';
export { changeUsername } from './auth/changeUsername';
export { follow, unfollow } from './social/follow';
export { removeListing } from './listings/removeListing';
export { saveListing, unsaveListing } from './social/save';
export { createPost } from './posts/createPost';
export { deletePost } from './posts/deletePost';
export { likePost, unlikePost, savePost, unsavePost } from './social/postEngagement';
export { countListingView } from './triggers/countListingView';
export { countPostEngagement } from './triggers/countPostEngagement';
export { refreshTagLabels } from './triggers/refreshTagLabels';
export { syncListingAvailability } from './triggers/syncListingAvailability';
export { onMessageCreated } from './triggers/onMessageCreated';
export { propagateProfileChanges } from './triggers/propagateProfileChanges';
export { requestBooking } from './bookings/requestBooking';
export {
  cancelBooking,
  confirmReceipt,
  confirmReturn,
  flagReturnProblem,
  recordDropoff,
  respondToBooking,
  setBlockedDates,
} from './bookings/lifecycle';
export { sweepBookings, runBookingSweep } from './bookings/sweep';
export { openConversation } from './messaging/openConversation';
export { sharePost } from './messaging/sharePost';
export { addComment, deleteComment } from './posts/comments';
export { writeReview, editReview } from './reviews/writeReview';
export { submitReport } from './moderation/report';
export { blockUser, unblockUser } from './moderation/block';
export { suspendUser, unsuspendUser, addAdminNote } from './admin/moderateUsers';
export {
  hideListing,
  restoreListing,
  hidePost,
  restorePost,
  hideReview,
  hideComment,
  restoreComment,
} from './admin/moderateContent';
export { resolveReport } from './admin/resolveReport';
export { resolveDispute } from './admin/resolveDispute';

// --- Later phases -----------------------------------------------------------
// export { saveListing }             from './social/save';        // Phase 3
