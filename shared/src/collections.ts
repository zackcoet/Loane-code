/**
 * Firestore collection names and document paths.
 *
 * Nothing anywhere in Loane should type a collection name as a raw string.
 * Import from here so a rename is one edit.
 */

export const COLLECTIONS = {
  campuses: 'campuses',
  users: 'users',
  usernames: 'usernames',
  listings: 'listings',
  posts: 'posts',
  follows: 'follows',
  likes: 'likes',
  postSaves: 'postSaves',
  comments: 'comments',
  saves: 'saves',
  bookings: 'bookings',
  reviews: 'reviews',
  conversations: 'conversations',
  notifications: 'notifications',
  reports: 'reports',
  supportRequests: 'supportRequests',
  damageClaims: 'damageClaims',
  adminActions: 'adminActions',
  events: 'events',
  circles: 'circles',
  legalDocs: 'legalDocs',
  legalDrafts: 'legalDrafts',
} as const;

export const SUBCOLLECTIONS = {
  /** users/{uid}/private/settings */
  userPrivate: 'private',
  /** users/{uid}/blocked/{blockedUid} */
  userBlocked: 'blocked',
  /** users/{uid}/notifications/{notificationId} */
  userNotifications: 'notifications',
  /** conversations/{id}/messages/{messageId} */
  messages: 'messages',
  /** circles/{id}/members/{uid} */
  circleMembers: 'members',
} as const;

export const paths = {
  campus: (campusId: string) => `${COLLECTIONS.campuses}/${campusId}`,
  user: (uid: string) => `${COLLECTIONS.users}/${uid}`,
  userPrivate: (uid: string) =>
    `${COLLECTIONS.users}/${uid}/${SUBCOLLECTIONS.userPrivate}/settings`,
  userBlocked: (uid: string, blockedUid: string) =>
    `${COLLECTIONS.users}/${uid}/${SUBCOLLECTIONS.userBlocked}/${blockedUid}`,
  notification: (uid: string, notificationId: string) =>
    `${COLLECTIONS.users}/${uid}/${SUBCOLLECTIONS.userNotifications}/${notificationId}`,
  username: (username: string) => `${COLLECTIONS.usernames}/${username.toLowerCase()}`,
  listing: (listingId: string) => `${COLLECTIONS.listings}/${listingId}`,
  post: (postId: string) => `${COLLECTIONS.posts}/${postId}`,
  booking: (bookingId: string) => `${COLLECTIONS.bookings}/${bookingId}`,
  conversation: (conversationId: string) => `${COLLECTIONS.conversations}/${conversationId}`,
  message: (conversationId: string, messageId: string) =>
    `${COLLECTIONS.conversations}/${conversationId}/${SUBCOLLECTIONS.messages}/${messageId}`,
} as const;

/**
 * Compound ids. Using a deterministic id instead of a random one is how we
 * make "one like per user per post" impossible to violate.
 */
export const ids = {
  like: (uid: string, postId: string) => `${uid}_${postId}`,
  postSave: (uid: string, postId: string) => `${uid}_${postId}`,
  save: (uid: string, listingId: string) => `${uid}_${listingId}`,
  follow: (followerUid: string, followingUid: string) => `${followerUid}_${followingUid}`,
  /** Sorted so the same two people always share one thread. */
  conversation: (uidA: string, uidB: string) => [uidA, uidB].sort().join('_'),
} as const;

/** Storage bucket folder layout. Mirrored by storage.rules. */
export const storagePaths = {
  profilePhoto: (uid: string, fileName: string) => `users/${uid}/profile/${fileName}`,
  listingPhoto: (uid: string, listingId: string, fileName: string) =>
    `users/${uid}/listings/${listingId}/${fileName}`,
  postPhoto: (uid: string, postId: string, fileName: string) =>
    `users/${uid}/posts/${postId}/${fileName}`,
  bookingPhoto: (uid: string, bookingId: string, fileName: string) =>
    `users/${uid}/bookings/${bookingId}/${fileName}`,
  claimPhoto: (uid: string, claimId: string, fileName: string) =>
    `users/${uid}/claims/${claimId}/${fileName}`,
  messagePhoto: (uid: string, fileName: string) => `users/${uid}/messages/${fileName}`,
} as const;
