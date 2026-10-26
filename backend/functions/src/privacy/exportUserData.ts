/**
 * "Download my data" — everything Loane holds about one student, as one
 * JSON file.
 *
 * Two doors:
 *   - `exportMyData`: she asks from Settings. Limited to a few a day,
 *     because it reads a lot.
 *   - `adminExportUserData`: an admin answers a privacy request from the
 *     dashboard. Audited with a reason, like every admin action.
 *
 * Deleting is the other half of a privacy request, and already exists:
 * `deleteMyAccount` (auth/deleteAccount.ts).
 *
 * WHAT IS LEFT OUT, ON PURPOSE:
 *   - `private/verification`: the hashed sign-up code. It is a security
 *     secret, not information about her.
 *   - Rate-limit counters and quotas: bookkeeping, not her data.
 *   - Admin notes about her, and an admin's private notes on reports she
 *     filed: those are our working notes. She still sees each report's
 *     status and what was done.
 *   - The other girl's side of a chat's settings — her unread count,
 *     when she last opened it, whether she muted or deleted it. See
 *     ownSideOfConversation.
 *   - Photos themselves: the export lists their links. A zip of every
 *     photo is a later improvement if anybody asks.
 *
 * Every query is a single equality (or array-contains) on one field, so
 * none of them needs a composite index in production.
 */

import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '@loane/shared';
import { db } from '../lib/admin';
import { invalidArgument, notFound, unauthenticated } from '../lib/errors';
import { rateLimit } from '../lib/rateLimit';
import { logAdminAction, requireAdminContext, requireReason } from '../admin/audit';

/** Caps so one export can never run away. A student is nowhere near these. */
const MAX_PER_COLLECTION = 2000;
const MAX_EVENTS = 5000;
const MAX_MESSAGES_PER_CHAT = 2000;

/** Private documents that are security material, not her information. */
const PRIVATE_DOCS_LEFT_OUT = new Set(['verification']);

export const EXPORT_FORMAT_VERSION = 1;

/** Timestamps → ISO strings, so the file reads like dates, not objects. */
export function toPlain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    // A DocumentReference or similar: keep its path, not its internals.
    const maybeRef = value as { path?: unknown; firestore?: unknown };
    if (typeof maybeRef.path === 'string' && maybeRef.firestore) return maybeRef.path;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

function docs(snaps: DocumentSnapshot[]) {
  return snaps.map((s) => ({ id: s.id, ...(toPlain(s.data()) as Record<string, unknown>) }));
}

async function where(collection: string, field: string, uid: string, limit = MAX_PER_COLLECTION) {
  // index-check: one == filter and no sort, whatever the field — no index needed.
  const snap = await db().collection(collection).where(field, '==', uid).limit(limit).get();
  return docs(snap.docs);
}

/** A report she filed, minus who handled it and their private notes. */
export function withoutAdminNotes(report: Record<string, unknown>): Record<string, unknown> {
  const resolution = report.resolution as Record<string, unknown> | null | undefined;
  if (!resolution) return report;
  return {
    ...report,
    resolution: { action: resolution.action ?? null, resolvedAt: resolution.resolvedAt ?? null },
  };
}

/**
 * A chat's settings, with only HER side of the per-person ones.
 *
 * A conversation keeps a few things per person: how many messages each
 * has unread, when each last opened it, when each deleted it from her
 * inbox, and who has muted it. The app never shows her the other girl's
 * side of those, and it must not leak through the export either: a
 * file saying she has 0 unread would tell you she read your message
 * even with "Show read receipts" off, and Instagram never tells you
 * that someone muted or deleted your chat. Her own side is her data,
 * so it stays. The messages themselves are both sides, as before.
 */
export function ownSideOfConversation(
  conversation: Record<string, unknown>,
  uid: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...conversation };
  for (const field of ['unreadCounts', 'lastReadAt', 'hiddenAt'] as const) {
    const perPerson = conversation[field];
    if (!perPerson || typeof perPerson !== 'object' || Array.isArray(perPerson)) continue;
    const mine = (perPerson as Record<string, unknown>)[uid];
    out[field] = mine === undefined ? {} : { [uid]: mine };
  }
  const muted = conversation.mutedUids;
  if (Array.isArray(muted)) out.mutedUids = muted.filter((m) => m === uid);
  return out;
}

export interface UserDataExport {
  format: number;
  exportedAt: string;
  uid: string;
  [section: string]: unknown;
}

/** Everything about one student. Throws notFound for an unknown uid. */
export async function collectUserData(uid: string): Promise<UserDataExport> {
  const userRef = db().collection(COLLECTIONS.users).doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw notFound('No student with that id.');

  const privateSnap = await userRef.collection(SUBCOLLECTIONS.userPrivate).get();
  const privateDocs = privateSnap.docs.filter((d) => !PRIVATE_DOCS_LEFT_OUT.has(d.id));

  const sub = async (name: string) =>
    docs((await userRef.collection(name).limit(MAX_PER_COLLECTION).get()).docs);

  // Her chats, each with its messages — both sides, as Instagram's own
  // export does: the conversation is hers too.
  const convoSnap = await db()
    .collection(COLLECTIONS.conversations)
    .where('participantUids', 'array-contains', uid)
    .limit(MAX_PER_COLLECTION)
    .get();
  const conversations = await Promise.all(
    convoSnap.docs.map(async (c) => {
      const messages = await c.ref
        .collection(SUBCOLLECTIONS.messages)
        .limit(MAX_MESSAGES_PER_CHAT)
        .get();
      return {
        id: c.id,
        ...ownSideOfConversation(toPlain(c.data()) as Record<string, unknown>, uid),
        messages: docs(messages.docs),
      };
    }),
  );

  const [
    listings,
    posts,
    comments,
    likes,
    commentLikes,
    postSaves,
    saves,
    following,
    followers,
    bookingsAsRenter,
    bookingsAsLender,
    reviewsWritten,
    reviewsAboutHer,
    reportsFiled,
    supportRequests,
    tryOns,
    events,
  ] = await Promise.all([
    where(COLLECTIONS.listings, 'ownerUid', uid),
    where(COLLECTIONS.posts, 'authorUid', uid),
    where(COLLECTIONS.comments, 'authorUid', uid),
    where(COLLECTIONS.likes, 'uid', uid),
    where(COLLECTIONS.commentLikes, 'uid', uid),
    where(COLLECTIONS.postSaves, 'uid', uid),
    where(COLLECTIONS.saves, 'uid', uid),
    where(COLLECTIONS.follows, 'followerUid', uid),
    where(COLLECTIONS.follows, 'followingUid', uid),
    where(COLLECTIONS.bookings, 'renterUid', uid),
    where(COLLECTIONS.bookings, 'lenderUid', uid),
    where(COLLECTIONS.reviews, 'authorUid', uid),
    where(COLLECTIONS.reviews, 'subjectUid', uid),
    where(COLLECTIONS.reports, 'reporterUid', uid),
    where(COLLECTIONS.supportRequests, 'requesterUid', uid),
    where(COLLECTIONS.tryOns, 'uid', uid),
    where(COLLECTIONS.events, 'uid', uid, MAX_EVENTS),
  ]);

  return {
    format: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    uid,
    profile: toPlain(userSnap.data()),
    privateSettings: docs(privateDocs),
    notifications: await sub(SUBCOLLECTIONS.userNotifications),
    blocked: await sub(SUBCOLLECTIONS.userBlocked),
    muted: await sub(SUBCOLLECTIONS.userMuted),
    listings,
    looks: posts,
    comments,
    likes,
    likedComments: commentLikes,
    savedLooks: postSaves,
    savedPieces: saves,
    following,
    followers,
    rentalsAsRenter: bookingsAsRenter,
    rentalsAsLender: bookingsAsLender,
    reviewsWritten,
    reviewsAboutHer,
    reportsFiled: reportsFiled.map(withoutAdminNotes),
    supportRequests,
    tryOns,
    conversations,
    activity: events,
  };
}

/** Settings → Download my data. */
export const exportMyData = onCall<void, Promise<UserDataExport>>(
  { region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw unauthenticated();
    await rateLimit(uid, 'dataExport');
    const data = await collectUserData(uid);
    logger.info('Data exported', { uid, by: 'self' });
    return data;
  },
);

/** Dashboard → a student → Export data. For privacy requests. */
export const adminExportUserData = onCall<{ uid: string; reason: string }, Promise<UserDataExport>>(
  { region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { uid, reason: rawReason } = request.data ?? {};
    if (!uid || typeof uid !== 'string') throw invalidArgument('Which student?');
    const reason = requireReason(rawReason, 'Why are you exporting her data?');

    const data = await collectUserData(uid);

    const batch = db().batch();
    logAdminAction(batch, {
      admin,
      action: 'user_data_exported',
      targetType: 'user',
      targetId: uid,
      notes: reason,
    });
    await batch.commit();
    logger.warn('Data exported by admin', { uid, by: admin.uid });
    return data;
  },
);
