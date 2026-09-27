/**
 * Loane Cloud Functions.
 *
 * Anything involving money, bookings, trust, verification or counting lives
 * here rather than in the app, because the app cannot be trusted. See
 * docs/security.md.
 *
 * Built and working today:
 *   - completeSignup   creates the account atomically: campus, username, profile
 *   - checkUsername    "is this taken?" for the claim-username screen
 *   - requestBooking   the double-booking-proof rental request
 *
 * Skeletons with TODOs, filled in during later phases:
 *   - social counters  (Phase 3)
 *   - booking lifecycle: accept, decline, handoff, return (Phase 4)
 *   - payments, payouts, protection holds, damage claims (Phase 5)
 *   - reviews, reports, push notifications (Phase 6)
 */

export { completeSignup } from './auth/completeSignup';
export { checkUsername } from './auth/checkUsername';
export { requestBooking } from './bookings/requestBooking';

// --- Later phases -----------------------------------------------------------
// export { follow, unfollow }        from './social/follow';      // Phase 3
// export { likePost, unlikePost }    from './social/like';        // Phase 3
// export { saveListing }             from './social/save';        // Phase 3
// export { respondToBooking }        from './bookings/respond';   // Phase 4
// export { confirmHandoff }          from './bookings/handoff';   // Phase 4
// export { confirmReturn }           from './bookings/return';    // Phase 4
// export { createReview }            from './reviews/create';     // Phase 6
// export { submitReport }            from './moderation/report';  // Phase 6
