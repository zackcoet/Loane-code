import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import type {
  DocumentReference,
  QueryDocumentSnapshot,
  WriteBatch,
} from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  DELETED_ACCOUNT_NAME,
  SUBCOLLECTIONS,
  accountDeletionBlockedMessage,
  blocksAccountDeletion,
  deletedUserSummary,
  deletedUsername,
  signedInRecently,
  type Booking,
  type Like,
  type Listing,
  type Post,
  type User,
} from '@loane/shared';
import { auth, db, FieldValue, now } from '../lib/admin';
import { failed, notFound, permissionDenied, unauthenticated } from '../lib/errors';
import { deleteStorageFolder } from '../tryon/images';

/**
 * `deleteMyAccount` — "Delete my account" in Settings.
 *
 * Apple requires it (guideline 5.1.1(v)), and our Privacy Policy and
 * Terms already promise exactly what it does:
 *
 *   - It refuses while she has a rental going, either side.
 *   - Everything that is HERS goes: her looks, pieces, comments, likes,
 *     saves, follows, alerts, phone number, campus email, try-on photos,
 *     profile photo and her login.
 *   - Records that are also somebody else's stay, without her name:
 *     past rentals, reviews she wrote, and chats (the other person's
 *     copy of a conversation is hers too).
 *
 * WHY HER USER DOCUMENT SURVIVES AS A SHELL. Bookings and reviews point
 * at her uid. Deleting the document would leave somebody's rental
 * history pointing at nothing. Instead it becomes "Deleted account",
 * status `deactivated`, with no name, photo, bio or sizes — and the
 * propagateProfileChanges trigger then rewrites every copy of her
 * name on listings, posts, comments and chats on its own.
 *
 * SAFE TO RUN TWICE. Each step skips what is already done, and the
 * login is deleted LAST, so if anything fails halfway she can simply
 * tap Delete again and it finishes.
 */

/**
 * Documents per batch. Firestore allows 500 writes per batch, and one
 * look can move up to six tagged pieces' counts (LIMITS.taggedListings)
 * as well as itself — 60 × 7 = 420 keeps every batch under the cap.
 */
const BATCH_SIZE = 60;

export const deleteMyAccount = onCall<void, Promise<{ ok: true }>>(
  { region: 'us-central1', timeoutSeconds: 300 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw unauthenticated();

    // She typed her password just now. A phone left unlocked on a desk
    // must not be enough to erase somebody.
    if (!signedInRecently(request.auth?.token.auth_time, Date.now())) {
      throw permissionDenied('For your safety, enter your password again first.');
    }

    const userRef = db().collection(COLLECTIONS.users).doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) throw notFound('We could not find your account.');
    const user = snap.data() as User;

    // Admins are deleted by hand, never by a button — on a two-person
    // team, one tap could remove the only way into the dashboard.
    if (user.role === 'admin' || request.auth?.token.admin === true) {
      throw failed('Admin accounts cannot be deleted from the app. Ask the team.');
    }

    await refuseIfRentalsOpen(uid);

    const removed = {
      posts: await removePosts(uid),
      listings: await removeListings(uid),
      comments: await removeComments(uid),
      likes: await removeLikes(uid),
      postSaves: await deleteWhere(COLLECTIONS.postSaves, 'uid', uid, postSaveCounter),
      saves: await deleteWhere(COLLECTIONS.saves, 'uid', uid, listingSaveCounter),
      follows: await removeFollows(uid),
      blocks: await removeBlocks(uid),
      reviews: await anonymizeReviews(uid, user.campusId),
    };

    // Her private subcollections: alerts, blocked, muted, dismissed
    // suggestions, and the settings doc holding her email and phone.
    // Deleting settings fires syncPhoneHash, which drops her from
    // contact matching.
    for (const sub of [
      SUBCOLLECTIONS.userNotifications,
      SUBCOLLECTIONS.userMuted,
      SUBCOLLECTIONS.userDismissedSuggestions,
      SUBCOLLECTIONS.userPrivate,
    ]) {
      await db().recursiveDelete(userRef.collection(sub));
    }
    await db().collection(COLLECTIONS.messageQuotas).doc(uid).delete();
    await db().collection(COLLECTIONS.listingQuotas).doc(uid).delete();

    // Try-on documents. The files go in the storage sweep below.
    await deleteWhere(COLLECTIONS.tryOns, 'uid', uid);

    // Files that are only hers. Listing photos are handled per listing in
    // removeListings, because a rented piece's photo is part of the
    // renter's history. Chat photos stay with the chat.
    for (const folder of ['profile', 'posts', 'tryon']) {
      await deleteStorageFolder(`users/${uid}/${folder}/`);
    }

    // The shell. This write is what renames her everywhere else.
    await userRef.update({
      username: deletedUsername(uid),
      firstName: '',
      displayName: DELETED_ACCOUNT_NAME,
      bio: '',
      photoUrl: null,
      isVerified: false,
      showSizes: false,
      sizes: { tops: null, bottoms: null, dresses: null, shoe: null },
      pushTokens: [],
      isFoundingCloset: false,
      status: 'deactivated',
      deletedAt: now(),
      lastActiveAt: null,
      'stats.followerCount': 0,
      'stats.followingCount': 0,
      'stats.listingCount': 0,
      'stats.postCount': 0,
      updatedAt: now(),
    });

    /*
      The username lock is KEPT, still pointing at her uid. Releasing it
      would let somebody else register "@ellapetrick" the next day and be
      mistaken for her by everyone who knew her. Admins can free it by
      hand if she ever asks. See docs/decisions.md.
    */

    // Last: the login. Once this is gone she cannot retry, so everything
    // above must already be finished.
    try {
      await auth().deleteUser(uid);
    } catch (err) {
      if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
    }

    logger.info('Account deleted', { uid, ...removed });
    return { ok: true };
  },
);

// ---------------------------------------------------------------------------

async function refuseIfRentalsOpen(uid: string): Promise<void> {
  // Two single-field queries rather than one OR query: equality on one
  // field needs no composite index, so this cannot fail in production
  // the way the booking sweep once did.
  const [asLender, asRenter] = await Promise.all([
    db().collection(COLLECTIONS.bookings).where('lenderUid', '==', uid).get(),
    db().collection(COLLECTIONS.bookings).where('renterUid', '==', uid).get(),
  ]);
  const open = new Set<string>();
  for (const doc of [...asLender.docs, ...asRenter.docs]) {
    if (blocksAccountDeletion((doc.data() as Booking).status)) open.add(doc.id);
  }
  if (open.size > 0) throw failed(accountDeletionBlockedMessage(open.size));
}

/** A change to somebody else's document, e.g. one fewer like on a look. */
interface CounterMove {
  ref: DocumentReference;
  patch: Record<string, unknown>;
}

/**
 * Commits writes in batches. `each` queues the deletes or updates of her
 * own documents onto the batch, and returns the counter moves it needs
 * on other people's.
 *
 * Counter moves are only applied to documents that still exist. An
 * update to a missing document fails the whole batch, and one stale
 * like pointing at a long-gone look must never be what stops somebody
 * deleting her account.
 */
async function inBatches(
  docs: QueryDocumentSnapshot[],
  each: (batch: WriteBatch, doc: QueryDocumentSnapshot) => CounterMove[] | void,
): Promise<number> {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db().batch();
    const moves: CounterMove[] = [];
    for (const doc of docs.slice(i, i + BATCH_SIZE)) moves.push(...(each(batch, doc) ?? []));
    if (moves.length > 0) {
      const snaps = await db().getAll(...moves.map((m) => m.ref));
      const exists = new Set(snaps.filter((x) => x.exists).map((x) => x.ref.path));
      for (const m of moves) if (exists.has(m.ref.path)) batch.update(m.ref, m.patch);
    }
    await batch.commit();
  }
  return docs.length;
}

const minusOne = (field: string) => ({ [field]: FieldValue.increment(-1) });

/** Deletes every doc where `field == uid`, moving a counter if given one. */
async function deleteWhere(
  collection: string,
  field: string,
  uid: string,
  counter?: (doc: QueryDocumentSnapshot) => CounterMove | null,
): Promise<number> {
  const snap = await db().collection(collection).where(field, '==', uid).get();
  return inBatches(snap.docs, (batch, doc) => {
    batch.delete(doc.ref);
    const c = counter?.(doc);
    return c ? [c] : [];
  });
}

function postSaveCounter(doc: QueryDocumentSnapshot) {
  const postId = (doc.data() as { postId?: string }).postId;
  return postId
    ? { ref: db().collection(COLLECTIONS.posts).doc(postId), patch: minusOne('stats.saveCount') }
    : null;
}

function listingSaveCounter(doc: QueryDocumentSnapshot) {
  const listingId = (doc.data() as { listingId?: string }).listingId;
  return listingId
    ? {
        ref: db().collection(COLLECTIONS.listings).doc(listingId),
        patch: minusOne('stats.saveCount'),
      }
    : null;
}

/** Her looks come down, giving back the tag counts they held. Same as deletePost. */
async function removePosts(uid: string): Promise<number> {
  const snap = await db().collection(COLLECTIONS.posts).where('authorUid', '==', uid).get();
  const live = snap.docs.filter((d) => (d.data() as Post).status !== 'removed');
  return inBatches(live, (batch, doc) => {
    const post = doc.data() as Post;
    batch.update(doc.ref, { status: 'removed', removedAt: now(), updatedAt: now() });
    return (post.taggedListingIds ?? []).map((listingId) => ({
      ref: db().collection(COLLECTIONS.listings).doc(listingId),
      patch: minusOne('stats.tagCount'),
    }));
  });
}

/**
 * Her pieces come down. Never hard-deleted (see removeListing). A piece
 * nobody ever asked to rent has its photos deleted too; a piece with
 * rental history keeps them, because they are in someone's My Rentals.
 */
async function removeListings(uid: string): Promise<number> {
  const snap = await db().collection(COLLECTIONS.listings).where('ownerUid', '==', uid).get();
  for (const doc of snap.docs) {
    const listing = doc.data() as Listing;
    const history = await db()
      .collection(COLLECTIONS.bookings)
      .where('listingId', '==', doc.id)
      .limit(1)
      .get();
    if (history.empty) await deleteStorageFolder(`users/${uid}/listings/${doc.id}/`);
    if (listing.status !== 'removed') {
      await doc.ref.update({ status: 'removed', removedAt: now(), updatedAt: now() });
    }
  }
  return snap.size;
}

/** Her comments come down, giving back each look's comment count. */
async function removeComments(uid: string): Promise<number> {
  const snap = await db().collection(COLLECTIONS.comments).where('authorUid', '==', uid).get();
  const live = snap.docs.filter((d) => (d.data() as { status: string }).status === 'active');
  return inBatches(live, (batch, doc) => {
    const postId = (doc.data() as { postId: string }).postId;
    batch.update(doc.ref, { status: 'removed', updatedAt: now() });
    return [
      {
        ref: db().collection(COLLECTIONS.posts).doc(postId),
        patch: minusOne('stats.commentCount'),
      },
    ];
  });
}

/** Her likes go, and "Liked by @her" goes with them. */
async function removeLikes(uid: string): Promise<number> {
  const snap = await db().collection(COLLECTIONS.likes).where('uid', '==', uid).get();
  const postIds = new Set<string>();
  const count = await inBatches(snap.docs, (batch, doc) => {
    const like = doc.data() as Like;
    postIds.add(like.postId);
    batch.delete(doc.ref);
    return [
      {
        ref: db().collection(COLLECTIONS.posts).doc(like.postId),
        patch: minusOne('stats.likeCount'),
      },
    ];
  });
  // Clear her from the "Liked by" line wherever she was the last liker.
  for (const postId of postIds) {
    const ref = db().collection(COLLECTIONS.posts).doc(postId);
    await db().runTransaction(async (tx) => {
      const post = await tx.get(ref);
      if (post.exists && (post.data() as Post).lastLiker?.uid === uid) {
        tx.update(ref, { lastLiker: null });
      }
    });
  }
  return count;
}

/** Both directions, moving the OTHER person's count each time. */
async function removeFollows(uid: string): Promise<number> {
  const follows = db().collection(COLLECTIONS.follows);
  const users = db().collection(COLLECTIONS.users);
  const [mine, theirs] = await Promise.all([
    follows.where('followerUid', '==', uid).get(),
    follows.where('followingUid', '==', uid).get(),
  ]);
  const a = await inBatches(mine.docs, (batch, doc) => {
    batch.delete(doc.ref);
    const other = (doc.data() as { followingUid: string }).followingUid;
    return [{ ref: users.doc(other), patch: minusOne('stats.followerCount') }];
  });
  const b = await inBatches(theirs.docs, (batch, doc) => {
    batch.delete(doc.ref);
    const other = (doc.data() as { followerUid: string }).followerUid;
    return [{ ref: users.doc(other), patch: minusOne('stats.followingCount') }];
  });
  return a + b;
}

/**
 * Her blocks go, with their mirror rows on the other side. Blocks other
 * people placed on HER stay — they are their choice, and harmless.
 */
async function removeBlocks(uid: string): Promise<number> {
  const userRef = db().collection(COLLECTIONS.users).doc(uid);
  const snap = await userRef.collection(SUBCOLLECTIONS.userBlocked).get();
  const count = await inBatches(snap.docs, (batch, doc) => {
    batch.delete(doc.ref);
    batch.delete(db().collection(COLLECTIONS.users).doc(doc.id).collection('blockedBy').doc(uid));
  });
  await db().recursiveDelete(userRef.collection('blockedBy'));
  return count;
}

/**
 * Reviews she wrote stay — they are part of somebody else's rating —
 * but without her name, as the Privacy Policy says. Reviews ABOUT her
 * are untouched; nobody looks them up once her profile is gone.
 */
async function anonymizeReviews(uid: string, campusId: string): Promise<number> {
  const snap = await db().collection(COLLECTIONS.reviews).where('authorUid', '==', uid).get();
  const author = deletedUserSummary(uid, campusId);
  return inBatches(snap.docs, (batch, doc) => {
    batch.update(doc.ref, { author, updatedAt: now() });
  });
}
