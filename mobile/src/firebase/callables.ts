/**
 * Typed wrappers around our Cloud Functions.
 *
 * The app calls these instead of writing sensitive collections directly —
 * the security rules forbid those writes. See docs/security.md.
 */

import { httpsCallable } from 'firebase/functions';
import type { ImageRef, Occasion } from '@loane/shared';
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
  },
  { reportId: string }
>(functions, 'submitReport');

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
