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
 *   - requestBooking     the double-booking-proof rental request
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
export { requestBooking } from './bookings/requestBooking';

// --- Later phases -----------------------------------------------------------
// export { likePost, unlikePost }    from './social/like';        // Phase 3
// export { saveListing }             from './social/save';        // Phase 3
// export { respondToBooking }        from './bookings/respond';   // Phase 4
// export { confirmHandoff }          from './bookings/handoff';   // Phase 4
// export { confirmReturn }           from './bookings/return';    // Phase 4
// export { createReview }            from './reviews/create';     // Phase 6
// export { submitReport }            from './moderation/report';  // Phase 6
