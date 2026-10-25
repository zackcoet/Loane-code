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
    const published = await publishDuePosts();
    if (published > 0) logger.info('Scheduled posts published', { count: published });
  },
);

/**
 * A ceiling, so one sweep can never run away. Far above anything real:
 * looks can only be booked 30 days ahead, and each girl only a few an hour.
 */
const MAX_SCHEDULED_READ = 2000;

/**
 * Publishes every scheduled look whose time has come. Returns how many.
 *
 * Exported for the tests; the schedule above is the only real caller.
 *
 * It reads ALL scheduled looks (only their time, so it stays cheap), not
 * just the first 100. With a cap of 100, 100 looks booked for next month
 * would sit in front of the one due now and it would never go up.
 *
 * Each look is published only if nothing has touched it since it was
 * read. Between the read and the write she might delete it, or an admin
 * might take it down — a blind write would put it back on the feed.
 */
export async function publishDuePosts(nowMs: number = Date.now()): Promise<number> {
  const snap = await db()
    .collection(COLLECTIONS.posts)
    .where('status', '==', 'scheduled')
    .select('scheduledAt')
    .limit(MAX_SCHEDULED_READ)
    .get();

  const due = snap.docs.filter((doc) => {
    const date = scheduledDate((doc.data() as Pick<Post, 'scheduledAt'>).scheduledAt);
    return date !== null && date.getTime() <= nowMs;
  });

  const results = await Promise.allSettled(
    due.map((doc) =>
      doc.ref.update({ status: 'active', updatedAt: now() }, { lastUpdateTime: doc.updateTime }),
    ),
  );
  const published = results.filter((r) => r.status === 'fulfilled').length;
  const skipped = results.length - published;
  if (skipped > 0) logger.info('Scheduled posts changed mid-sweep, left alone', { skipped });
  return published;
}

function scheduledDate(value: Post['scheduledAt']): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}
