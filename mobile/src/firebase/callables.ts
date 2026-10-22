/**
 * Typed wrappers around our Cloud Functions.
 *
 * The app calls these instead of writing sensitive collections directly —
 * the security rules forbid those writes. See docs/security.md.
 */

import { httpsCallable } from 'firebase/functions';
import type { ImageRef, Occasion, PostSettings, SupportTopic } from '@loane/shared';
import { functions } from './config';

/**
 * Creates the login, the profile and the username lock in one server-side
 * call, and returns a one-time token the app signs in with. The app never
 * creates a Firebase Auth account itself, so a login can never exist
 * without a Loane profile behind it.
 */
export const createAccount = httpsCallable<
  { firstName: string; email: string; password: string; username: string },
  { uid: string; username: string; campusId: string; token: string }
>(functions, 'createAccount');

export const checkCampusEmail = httpsCallable<
  { email: string },
  { allowed: boolean; campusName?: string; reason?: string }
>(functions, 'checkCampusEmail');

export const checkUsername = httpsCallable<
  { username: string },
  { available: boolean; reason?: string }
>(functions, 'checkUsername');

export const changeUsername = httpsCallable<{ username: string }, { username: string }>(
  functions,
  'changeUsername',
);

export const followUser = httpsCallable<{ uid: string }, { following: boolean }>(
  functions,
  'follow',
);

/**
 * Who to follow, ranked by mutual follows.
 *
 * A function rather than a query because ranking needs to read other
 * students' following lists, and only the COUNT comes back. See
 * backend/functions/src/social/suggestedClosets.ts.
 */
export const suggestedClosets = httpsCallable<
  { limit?: number },
  {
    closets: {
      uid: string;
      username: string;
      displayName: string;
      photoUrl: string | null;
      campusId: string;
      isVerified: boolean;
      mutualCount: number;
      followerCount: number;
    }[];
  }
>(functions, 'suggestedClosets');

/**
 * Which of her contacts are already on Loane.
 *
 * SHA-256 of each number goes up; nothing comes back that says which
 * contact matched which account, and the request is never stored.
 * See backend/functions/src/social/matchContacts.ts.
 */
export interface ContactMatch {
  uid: string;
  username: string;
  displayName: string;
  photoUrl: string | null;
  campusId: string;
  isVerified: boolean;
  isFollowing: boolean;
}

export const matchContacts = httpsCallable<{ hashes: string[] }, { matches: ContactMatch[] }>(
  functions,
  'matchContacts',
);

export const unfollowUser = httpsCallable<{ uid: string }, { following: boolean }>(
  functions,
  'unfollow',
);

/**
 * Hides a listing. Never deletes — a rented piece is part of someone
 * else's history. Refuses while a rental is in flight.
 */
export const removeListing = httpsCallable<
  { listingId: string },
  { keptForHistory: boolean; bookingCount: number }
>(functions, 'removeListing');

/** Saving drives a counter, so like follows it is server-owned. */
export const saveListing = httpsCallable<{ listingId: string }, { saved: boolean }>(
  functions,
  'saveListing',
);

export const unsaveListing = httpsCallable<{ listingId: string }, { saved: boolean }>(
  functions,
  'unsaveListing',
);

/**
 * Posts are created server-side: tagging a garment moves a counter on that
 * listing, and the flattened tag ids have to agree with the photos.
 */
export const createPost = httpsCallable<
  {
    photos: { path: string; url: string; width: number; height: number; tags: PostTagInput[] }[];
    caption: string;
    occasions: Occasion[];
    settings: PostSettings;
    scheduledAt?: string | null;
  },
  { postId: string }
>(functions, 'createPost');

export interface PostTagInput {
  listingId: string;
  /** Fraction of the photo, 0-1. Never pixels. */
  x: number;
  y: number;
}

export const deletePost = httpsCallable<{ postId: string }, { ok: true }>(functions, 'deletePost');

export const likePost = httpsCallable<{ postId: string }, { on: boolean }>(functions, 'likePost');
export const unlikePost = httpsCallable<{ postId: string }, { on: boolean }>(
  functions,
  'unlikePost',
);
export const savePost = httpsCallable<{ postId: string }, { on: boolean }>(functions, 'savePost');
export const unsavePost = httpsCallable<{ postId: string }, { on: boolean }>(
  functions,
  'unsavePost',
);

export const respondToBooking = httpsCallable<
  { bookingId: string; accept: boolean; reason?: string },
  { status: string }
>(functions, 'respondToBooking');

export const recordDropoff = httpsCallable<
  { bookingId: string; photos: ImageRef[]; notes?: string },
  { ok: true }
>(functions, 'recordDropoff');

export const confirmReceipt = httpsCallable<{ bookingId: string }, { ok: true }>(
  functions,
  'confirmReceipt',
);

export const confirmReturn = httpsCallable<
  { bookingId: string; photos?: ImageRef[] },
  { ok: true }
>(functions, 'confirmReturn');

export const flagReturnProblem = httpsCallable<
  { bookingId: string; problem: string; note: string; photos: ImageRef[] },
  { ok: true }
>(functions, 'flagReturnProblem');

export const cancelBooking = httpsCallable<{ bookingId: string; reason: string }, { ok: true }>(
  functions,
  'cancelBooking',
);

export const setBlockedDates = httpsCallable<
  { listingId: string; dates: string[] },
  { blocked: string[] }
>(functions, 'setBlockedDates');

/**
 * The one thread between two students. Messaging her about a dress and
 * the chat a confirmed rental gets are the same conversation.
 */
export const openConversation = httpsCallable<
  { withUid: string; listingId?: string; bookingId?: string },
  { conversationId: string }
>(functions, 'openConversation');

/** Only someone who actually completed the rental can review it. */
export const writeReview = httpsCallable<
  { bookingId: string; rating: number; body: string },
  { reviewId: string }
>(functions, 'writeReview');

export const editReview = httpsCallable<
  { reviewId: string; rating: number; body: string },
  { ok: true }
>(functions, 'editReview');

export const submitReport = httpsCallable<
  {
    targetType: 'user' | 'listing' | 'post' | 'booking' | 'message' | 'comment' | 'review';
    targetId: string;
    targetUid?: string;
    reason: string;
    details?: string;
    photos?: ImageRef[];
  },
  { reportId: string }
>(functions, 'submitReport');

export const submitSupportRequest = httpsCallable<
  { topic: SupportTopic; message: string },
  { requestId: string }
>(functions, 'submitSupportRequest');

export const blockUser = httpsCallable<{ uid: string }, { ok: true }>(functions, 'blockUser');
export const unblockUser = httpsCallable<{ uid: string }, { ok: true }>(functions, 'unblockUser');

export const requestBooking = httpsCallable<
  { listingId: string; startDate: string; endDate: string; message?: string },
  { bookingId: string; status: string }
>(functions, 'requestBooking');

/**
 * Comments on a look.
 *
 * Functions rather than direct writes because the count under the post
 * has to move with the comment, and the name on it has to really be
 * hers.
 */
export const addComment = httpsCallable<
  { postId: string; body: string; parentCommentId?: string },
  { commentId: string }
>(functions, 'addComment');
export const deleteComment = httpsCallable<{ commentId: string }, { ok: true }>(
  functions,
  'deleteComment',
);

/** Sends a look into one or more chats. */
export const sharePost = httpsCallable<
  { postId: string; toUids: string[]; note?: string },
  { sentTo: number; conversationId: string | null }
>(functions, 'sharePost');

/** Sends a piece from someone's closet into one or more chats. */
export const shareListing = httpsCallable<
  { listingId: string; toUids: string[]; note?: string },
  { sentTo: number; conversationId: string | null }
>(functions, 'shareListing');

export const acceptLegalDocs = httpsCallable<
  { termsVersion: number; privacyVersion: number },
  { ok: true }
>(functions, 'acceptLegalDocs');

// ---------------------------------------------------------------------------
// AI try-on
//
// Everything that costs money, and everything that records consent, runs
// server-side. The app cannot call FASHN and cannot write a tryOn
// document or the tryOn block on her private settings.
// ---------------------------------------------------------------------------

export interface TryOnPieceSummary {
  listingId: string;
  name: string;
  coverUrl: string | null;
  ownerUid: string;
  category: string;
}

export const generateTryOn = httpsCallable<
  { bodyKind: 'own' | 'preset'; presetId?: string; listingIds: string[] },
  { tryOnId: string; imagePath: string; cached: boolean; remaining: number }
>(functions, 'generateTryOn');

/** The confirmation travels with the photo; the server refuses it without. */
export const setTryOnBodyPhoto = httpsCallable<
  { path: string; confirmed: boolean },
  { ok: true }
>(functions, 'setTryOnBodyPhoto');

export const clearTryOnBodyPhoto = httpsCallable<void, { ok: true }>(
  functions,
  'clearTryOnBodyPhoto',
);

/** Her body photo, every saved look, every file. One tap, from Settings. */
/**
 * Deletes her whole account. Needs a password sign-in from the last few
 * minutes — the delete-account screen re-authenticates first. Refuses
 * while she has a rental going.
 */
export const deleteMyAccount = httpsCallable<void, { ok: true }>(functions, 'deleteMyAccount');

/** Everything Loane holds about her, as one JSON object. See privacy/exportUserData.ts. */
export const exportMyData = httpsCallable<void, Record<string, unknown>>(
  functions,
  'exportMyData',
);

export const deleteTryOnData = httpsCallable<void, { deleted: number }>(
  functions,
  'deleteTryOnData',
);

// --- Admin only ---
export const grantTryOns = httpsCallable<
  { uid: string; count: number; reason: string },
  { total: number }
>(functions, 'grantTryOns');

export const setTryOnConfig = httpsCallable<
  { enabled?: boolean; enabledForAdmins?: boolean; reason: string },
  { ok: true }
>(functions, 'setTryOnConfig');

/**
 * A quick look at a photo before we keep it.
 *
 * The image travels as base64 and is never stored to be checked, so a
 * body photo that fails never reaches Storage at all. It fails open:
 * `skipped` means we could not check and let it through.
 */
export const checkPhoto = httpsCallable<
  { kind: 'body' | 'flat'; imageBase64: string; mediaType: string },
  { ok: boolean; fix: string | null; skipped: boolean }
>(functions, 'checkPhoto');

/**
 * A lender's garment photo, checked and cut out in one call.
 *
 * Returns a specific fix when the photo is not one clean garment, and
 * a transparent PNG when it is. Every failure after the check keeps
 * her original photo rather than discarding something that already
 * passed.
 */
export const prepareFlatPhoto = httpsCallable<
  { imageBase64: string },
  { ok: boolean; fix: string | null; imageBase64: string | null; usedOriginal: boolean }
>(functions, 'prepareFlatPhoto');

/**
 * Own It. A purchase is a booking with no dates, so it joins the same
 * lifecycle rentals use — accept, handoff, both confirm.
 *
 * Refused with "On Loane until 4 Oct" when somebody has already been
 * promised the piece. The server is the only thing that knows that.
 */
export const requestPurchase = httpsCallable<
  { listingId: string; message?: string },
  { bookingId: string }
>(functions, 'requestPurchase');
