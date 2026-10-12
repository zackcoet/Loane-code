import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { COLLECTIONS, type Post } from '@loane/shared';
import { db, now } from '../lib/admin';

/**
 * Publishes looks whose scheduled time has arrived.
 *
 * This deliberately filters due posts in code instead of requiring a
 * composite index on status + scheduledAt. Scheduled posts should be a
 * tiny slice of all posts for MVP, and avoiding an index deployment keeps
 * this feature easier to ship.
 */
export const publishScheduledPosts = onSchedule(
  { schedule: 'every 5 minutes', region: 'us-central1' },
  async () => {
    const snap = await db()
      .collection(COLLECTIONS.posts)
      .where('status', '==', 'scheduled')
      .limit(100)
      .get();

    const due = snap.docs.filter((doc) => {
      const post = doc.data() as Post;
      const date = scheduledDate(post.scheduledAt);
      return date !== null && date.getTime() <= Date.now();
    });

    if (due.length === 0) return;

    const batch = db().batch();
    for (const doc of due) {
      batch.update(doc.ref, { status: 'active', updatedAt: now() });
    }
    await batch.commit();

    logger.info('Scheduled posts published', { count: due.length });
  },
);

function scheduledDate(value: Post['scheduledAt']): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}
