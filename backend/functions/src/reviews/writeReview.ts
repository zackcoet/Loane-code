import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  COLLECTIONS,
  LIMITS,
  REVIEW_EDIT_WINDOW_HOURS,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
  type Booking,
  type Review,
  type User,
} from '@loane/shared';
import { db, now } from '../lib/admin';
import { failed, invalidArgument, notFound, permissionDenied } from '../lib/errors';
import { requireActiveUser } from '../lib/guards';
import { notify } from '../bookings/transitions';

/**
 * `writeReview` and `editReview`.
 *
 * A review can only be written by someone who ACTUALLY RENTED with the
 * person she is rating, on a rental that actually finished. That single
 * rule is the whole difference between a rating system and a comment
 * box — without it, anyone could rate anyone and the stars on a profile
 * would mean nothing.
 *
 * Reviews open once a booking reaches `completed`, which is after the
 * lender's 48-hour window to flag a problem has passed. Reviewing a
 * rental that is about to be disputed would be messy for both sides.
 *
 * The star average is recomputed here, in the same transaction, so a
 * profile's rating can never drift from the reviews behind it.
 */

interface WriteInput {
  bookingId: string;
  rating: number;
  body: string;
}

function validate(rating: number, body: string): void {
  if (!Number.isInteger(rating) || rating < REVIEW_MIN_RATING || rating > REVIEW_MAX_RATING) {
    throw invalidArgument(`Pick between ${REVIEW_MIN_RATING} and ${REVIEW_MAX_RATING} stars.`);
  }
  if (body.length > LIMITS.reportDetails.max) {
    throw invalidArgument('That review is too long.');
  }
}

export const writeReview = onCall<WriteInput, Promise<{ reviewId: string }>>(
  { region: 'us-central1' },
  async (request: CallableRequest<WriteInput>): Promise<{ reviewId: string }> => {
    const author = await requireActiveUser(request);
    const { bookingId, rating, body = '' } = request.data ?? {};
    if (!bookingId) throw invalidArgument('Which rental?');
    validate(rating, body);

    const bookingRef = db().collection(COLLECTIONS.bookings).doc(bookingId);
    const reviewRef = db().collection(COLLECTIONS.reviews).doc();

    await db().runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw notFound('We could not find that rental.');

      const booking = bookingSnap.data() as Booking;

      // Were you actually part of this rental?
      const isLender = booking.lenderUid === author.uid;
      const isRenter = booking.renterUid === author.uid;
      if (!isLender && !isRenter) throw permissionDenied('That rental is not yours.');

      // Did it actually finish?
      if (booking.status !== 'completed') {
        throw failed(
          booking.status === 'disputed'
            ? 'This rental has a problem open. Reviews wait until it is settled.'
            : 'You can leave a review once the rental is finished.',
        );
      }

      // One review each, not one each per sitting.
      const already = isLender ? booking.reviews.lenderReviewId : booking.reviews.renterReviewId;
      if (already) throw failed('You have already reviewed this rental.');

      const subjectUid = isLender ? booking.renterUid : booking.lenderUid;
      const subjectRef = db().collection(COLLECTIONS.users).doc(subjectUid);
      const subjectSnap = await tx.get(subjectRef);
      if (!subjectSnap.exists) throw notFound('We could not find that student.');
      const subject = subjectSnap.data() as User;

      const review: Omit<Review, 'createdAt' | 'updatedAt'> = {
        id: reviewRef.id,
        campusId: booking.campusId,
        bookingId,
        listingId: booking.listingId,
        authorUid: author.uid,
        author: {
          uid: author.uid,
          username: author.username,
          displayName: author.displayName,
          photoUrl: author.photoUrl,
          campusId: author.campusId,
          isVerified: author.isVerified,
        },
        subjectUid,
        authorRole: isLender ? 'lender' : 'renter',
        rating,
        body: body.trim(),
        isHidden: false,
      };

      tx.set(reviewRef, { ...review, createdAt: now(), updatedAt: now() });

      tx.update(bookingRef, {
        [isLender ? 'reviews.lenderReviewId' : 'reviews.renterReviewId']: reviewRef.id,
        updatedAt: now(),
      });

      // Recompute the average here, in the same transaction, so a
      // profile's stars can never disagree with the reviews behind them.
      const count = subject.stats.ratingCount + 1;
      const total = (subject.stats.ratingAverage ?? 0) * subject.stats.ratingCount + rating;
      tx.update(subjectRef, {
        'stats.ratingCount': count,
        'stats.ratingAverage': Math.round((total / count) * 100) / 100,
        updatedAt: now(),
      });

      notify(tx, {
        uid: subjectUid,
        type: 'review_received',
        title: 'You got a review',
        body: `${author.username} left you ${rating} ${rating === 1 ? 'star' : 'stars'}.`,
        bookingId,
        actor: { uid: author.uid, username: author.username, photoUrl: author.photoUrl },
      });
    });

    logger.info('Review written', { reviewId: reviewRef.id, bookingId });
    return { reviewId: reviewRef.id };
  },
);

/**
 * Change a review, within 48 hours of writing it.
 *
 * After that it is frozen. A rating that can be quietly rewritten months
 * later to settle a score is not a rating anyone should trust.
 */
export const editReview = onCall<
  { reviewId: string; rating: number; body: string },
  Promise<{ ok: true }>
>({ region: 'us-central1' }, async (request) => {
  const author = await requireActiveUser(request);
  const { reviewId, rating, body = '' } = request.data ?? {};
  if (!reviewId) throw invalidArgument('Which review?');
  validate(rating, body);

  const reviewRef = db().collection(COLLECTIONS.reviews).doc(reviewId);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(reviewRef);
    if (!snap.exists) throw notFound('We could not find that review.');

    const review = snap.data() as Review;
    if (review.authorUid !== author.uid) throw permissionDenied('That is not your review.');

    const written = (review.createdAt as { toDate?: () => Date } | null)?.toDate?.();
    if (written && Date.now() - written.getTime() > REVIEW_EDIT_WINDOW_HOURS * 3600_000) {
      throw failed(`Reviews can only be changed within ${REVIEW_EDIT_WINDOW_HOURS} hours.`);
    }

    const subjectRef = db().collection(COLLECTIONS.users).doc(review.subjectUid);
    const subjectSnap = await tx.get(subjectRef);
    if (!subjectSnap.exists) throw notFound('We could not find that student.');
    const subject = subjectSnap.data() as User;

    tx.update(reviewRef, { rating, body: body.trim(), updatedAt: now() });

    // Swap the old score out of the average and the new one in.
    const count = subject.stats.ratingCount;
    if (count > 0) {
      const total = (subject.stats.ratingAverage ?? 0) * count - review.rating + rating;
      tx.update(subjectRef, {
        'stats.ratingAverage': Math.round((total / count) * 100) / 100,
        updatedAt: now(),
      });
    }
  });

  return { ok: true };
});
