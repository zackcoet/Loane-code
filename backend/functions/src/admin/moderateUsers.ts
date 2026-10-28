import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import {
  brand,
  COLLECTIONS,
  foundingClosetBlockedReason,
  isIsoDate,
  suspendBlockedReason,
  campusToday,
  type User,
} from '@loane/shared';
import { db, now, Timestamp } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { logAdminAction, requireAdminContext, requireReason } from './audit';
import { notify } from '../bookings/transitions';

/**
 * Suspending and unsuspending a student.
 *
 * Three rules are built in rather than left to whoever clicks:
 *
 *   1. Nobody can suspend themselves. Locking yourself out of your own
 *      admin panel is a bad afternoon.
 *   2. Admins cannot be suspended by other admins. On a two-person team
 *      that is a foot-gun, not a safeguard — removing an admin should be
 *      deliberate and rare, not one click in a list.
 *   3. A suspended student can still read Loane. She just cannot act,
 *      and she is told why. Silently breaking every button is how you
 *      get an angry email you cannot answer.
 */

interface SuspendInput {
  uid: string;
  reason: string;
  /** Optional calendar date the suspension is meant to end (see parseUntil). */
  until?: string;
}

/** A student's uid, or a clear answer if what came in isn't one. */
function requireUid(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128 || value.includes('/')) {
    throw invalidArgument('Which student?');
  }
  return value;
}

/**
 * The optional "lifts on" date: a plain calendar date, after today.
 *
 * NOTE: nothing lifts a suspension on its own yet — the date is kept on
 * her account for whoever reviews it. The dashboard doesn't send one
 * today. It is checked anyway so a bad one is refused instead of
 * crashing into "something went wrong".
 */
function parseUntil(value: unknown): Timestamp | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !isIsoDate(value)) {
    throw invalidArgument('The end date should look like 2026-11-01.');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw invalidArgument('That end date is not a real day.');
  if (value <= campusToday()) throw invalidArgument('The end date has to be after today.');
  return Timestamp.fromDate(date);
}

export const suspendUser = onCall<SuspendInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { uid: rawUid, reason: rawReason, until: rawUntil } = request.data ?? {};
    const uid = requireUid(rawUid);
    const reason = requireReason(rawReason, 'Say why. It goes in the audit log and to her.');
    const until = parseUntil(rawUntil);

    if (uid === admin.uid) throw failed("You can't suspend yourself.");

    const ref = db().collection(COLLECTIONS.users).doc(uid);

    // In one step, so two admins clicking at once can't both get
    // through and send her two notices.
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw notFound('We could not find that student.');

      const user = snap.data() as User;
      if (user.role === 'admin') {
        throw failed('Admins cannot be suspended from here. Remove the admin claim first.');
      }
      const blocked = suspendBlockedReason(user.status);
      if (blocked) throw failed(blocked);

      tx.update(ref, {
        status: 'suspended',
        suspendedReason: reason,
        suspendedUntil: until,
        updatedAt: now(),
      });
      // She finds out inside the app rather than by everything breaking.
      notify(tx, {
        uid,
        type: 'admin_notice',
        title: 'Your account is suspended',
        body: `${reason} Write to ${brand.supportEmail} if you think this is wrong.`,
        bookingId: '',
      });
      logAdminAction(tx, {
        admin,
        action: 'suspend_user',
        targetType: 'user',
        targetId: uid,
        notes: reason,
        before: { status: user.status },
        after: { status: 'suspended', suspendedUntil: until ? (rawUntil as string) : null },
      });
    });

    logger.info('User suspended', { uid, by: admin.uid });
    return { ok: true };
  },
);

export const unsuspendUser = onCall<{ uid: string; reason: string }, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { uid: rawUid, reason: rawReason } = request.data ?? {};
    const uid = requireUid(rawUid);
    const reason = requireReason(rawReason, 'Say why you are lifting this.');

    const ref = db().collection(COLLECTIONS.users).doc(uid);

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw notFound('We could not find that student.');
      const user = snap.data() as User;

      // Only a suspended account comes back. This used to set ANY account
      // to active — including a deleted one, which turned a "Deleted
      // account" shell back into a live account.
      if (user.status !== 'suspended') {
        throw failed(
          user.status === 'deactivated'
            ? 'That account is deleted. It cannot be brought back from here.'
            : 'She is not suspended.',
        );
      }

      tx.update(ref, {
        status: 'active',
        suspendedReason: null,
        suspendedUntil: null,
        updatedAt: now(),
      });
      notify(tx, {
        uid,
        type: 'admin_notice',
        title: 'Your account is active again',
        body: 'You can post, list and rent as normal.',
        bookingId: '',
      });
      logAdminAction(tx, {
        admin,
        action: 'unsuspend_user',
        targetType: 'user',
        targetId: uid,
        notes: reason,
        before: { status: user.status, suspendedReason: user.suspendedReason ?? null },
        after: { status: 'active' },
      });
    });

    return { ok: true };
  },
);

/**
 * Private notes on a student, visible only to admins.
 *
 * The kind of thing you need when the same name comes up twice:
 * "warned her about off-platform payment on the 3rd".
 */
export const addAdminNote = onCall<{ uid: string; note: string }, Promise<{ noteId: string }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { uid: rawUid, note: rawNote } = request.data ?? {};
    const uid = requireUid(rawUid);
    const note = requireReason(rawNote, 'Write the note first.');

    const userRef = db().collection(COLLECTIONS.users).doc(uid);
    if (!(await userRef.get()).exists) throw notFound('We could not find that student.');

    const noteRef = userRef.collection('adminNotes').doc();
    const batch = db().batch();
    batch.set(noteRef, {
      id: noteRef.id,
      uid,
      note,
      adminUid: admin.uid,
      adminEmail: admin.email,
      createdAt: now(),
      updatedAt: now(),
    });
    logAdminAction(batch, {
      admin,
      action: 'add_admin_note',
      targetType: 'user',
      targetId: uid,
      notes: note,
    });
    await batch.commit();

    return { noteId: noteRef.id };
  },
);

/**
 * Marking a student as a Founding Closet (or taking her off).
 *
 * The dashboard has had a Founding Closets page since September, but the
 * only thing that ever set the mark was the emulator's fake data — on
 * the live project the page could only ever be empty. Only a server can
 * write it (the database rules refuse it from the phone), it is audited
 * like every other admin action, and it is never shown to her or to
 * other students: it is the team's own list of launch closets.
 */
export const setFoundingCloset = onCall<
  { uid: string; on: boolean; reason: string },
  Promise<{ ok: true }>
>({ region: 'us-central1' }, async (request) => {
  const admin = requireAdminContext(request);
  const { uid: rawUid, on, reason: rawReason } = request.data ?? {};
  const uid = requireUid(rawUid);
  if (typeof on !== 'boolean') throw invalidArgument('Mark her, or take her off?');
  const reason = requireReason(rawReason, 'Say why. It goes in the audit log.');

  const ref = db().collection(COLLECTIONS.users).doc(uid);

  // One step, so a double-click writes one audit row, not two.
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound('We could not find that student.');
    const user = snap.data() as User;
    const blocked = foundingClosetBlockedReason(
      { ...user, isFoundingCloset: user.isFoundingCloset === true },
      on,
    );
    if (blocked) throw failed(blocked);

    tx.update(ref, { isFoundingCloset: on, updatedAt: now() });
    logAdminAction(tx, {
      admin,
      action: on ? 'founding_closet_marked' : 'founding_closet_unmarked',
      targetType: 'user',
      targetId: uid,
      notes: reason,
      before: { isFoundingCloset: !on },
      after: { isFoundingCloset: on },
    });
  });

  logger.info('Founding closet changed', { uid, on, by: admin.uid });
  return { ok: true };
});
