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
  commentLikes: 'commentLikes',
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
  /**
   * phoneHashes/{hash}
   *
   * One document per student who has saved a phone number, keyed by a
   * peppered hash of it. Holds a uid and nothing else — no number, no
   * name. This is what makes "is this contact on Loane?" answerable
   * without anybody's address book being stored. See
   * backend/functions/src/lib/phoneHash.ts.
   */
  phoneHashes: 'phoneHashes',
  /**
   * tryOns/{tryOnId} — generated try-on images. Private to their owner,
   * written only by Cloud Functions. See docs/decisions.md.
   */
  tryOns: 'tryOns',
  /**
   * config/{docId} — runtime switches an admin can flip without a
   * deploy. Readable by any signed-in student so the app can hide a
   * feature; written only through an admin function.
   */
  config: 'config',
  /**
   * rateLimits/{action}__{uid or ip} — one counter per person per
   * action. Written only by Cloud Functions; no client ever reads or
   * writes it, and the security rules seal it shut.
   */
  rateLimits: 'rateLimits',
  /**
   * messageQuotas/{uid} — how many messages she has sent this hour.
   * Unlike rateLimits this one IS written by the app, in the same
   * batch as every message, because messages are app-written for
   * speed. The rules check every message moves her own counter by
   * exactly one and refuse once it is full. See messageQuota.ts.
   */
  messageQuotas: 'messageQuotas',
  /**
   * listingQuotas/{uid} — how many new pieces she has listed this hour.
   * Same shape and same idea as messageQuotas: listings are written by
   * the app, so every new one is batched with a tick of this counter
   * and the rules refuse it once the hour is full.
   */
  listingQuotas: 'listingQuotas',
  /**
   * trending/{campusId} — the week's most-wanted pieces on a campus.
   * Written only by the hourly `refreshTrending` function; see
   * shared/src/trending.ts.
   */
  trending: 'trending',
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
  /**
   * users/{uid}/dismissedSuggestions/{otherUid}
   *
   * Closets she tapped the X on. Written by the app rather than a
   * function: it moves no counter and affects nothing but what she
   * herself sees, which is the line "never trust the phone" draws.
   */
  userDismissedSuggestions: 'dismissedSuggestions',
  /**
   * users/{uid}/muted/{otherUid}
   *
   * People whose looks she has hidden from her feed without blocking.
   * Written by the app for the same reason as dismissedSuggestions: it
   * changes only what she herself sees, and the muted person is never
   * told or affected. Nothing else reads it.
   */
  userMuted: 'muted',
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
  commentLike: (uid: string, commentId: string) => `${uid}_${commentId}`,
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
  /**
   * Her body photo for try-on, and the generated results.
   *
   * THE ONLY OWNER-READ PATHS IN THE BUCKET. Everything above is
   * readable by at least any signed-in student, because listing and
   * post photos appear in feeds. These two are not, and not even an
   * admin may read them. See backend/storage.rules.
   */
  tryOnBodyPhoto: (uid: string, fileName: string) => `users/${uid}/tryon/body/${fileName}`,
  tryOnResult: (uid: string, fileName: string) => `users/${uid}/tryon/results/${fileName}`,
} as const;
