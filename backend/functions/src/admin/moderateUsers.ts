import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { brand, COLLECTIONS, type User } from '@loane/shared';
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
  /** Optional ISO date the suspension lifts on its own. */
  until?: string;
}

export const suspendUser = onCall<SuspendInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { uid, reason: rawReason, until } = request.data ?? {};
    if (!uid) throw invalidArgument('Which student?');

    const reason = requireReason(rawReason, 'Say why. It goes in the audit log and to her.');

    if (uid === admin.uid) throw failed("You can't suspend yourself.");

    const ref = db().collection(COLLECTIONS.users).doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('We could not find that student.');

    const user = snap.data() as User;
    if (user.role === 'admin') {
      throw failed('Admins cannot be suspended from here. Remove the admin claim first.');
    }
    if (user.status === 'suspended') throw failed('She is already suspended.');

    const batch = db().batch();
    batch.update(ref, {
      status: 'suspended',
      suspendedReason: reason,
      suspendedUntil: until ? Timestamp.fromDate(new Date(`${until}T00:00:00Z`)) : null,
      updatedAt: now(),
    });
    // She finds out inside the app rather than by everything breaking.
    notify(batch, {
      uid,
      type: 'admin_notice',
      title: 'Your account is suspended',
      body: `${reason} Write to ${brand.supportEmail} if you think this is wrong.`,
      bookingId: '',
    });
    logAdminAction(batch, {
      admin,
      action: 'suspend_user',
      targetType: 'user',
      targetId: uid,
      notes: reason,
      before: { status: user.status },
      after: { status: 'suspended', suspendedUntil: until ?? null },
    });
    await batch.commit();

    logger.info('User suspended', { uid, by: admin.uid });
    return { ok: true };
  },
);

export const unsuspendUser = onCall<{ uid: string; reason: string }, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { uid, reason: rawReason } = request.data ?? {};
    if (!uid) throw invalidArgument('Which student?');
    const reason = requireReason(rawReason, 'Say why you are lifting this.');

    const ref = db().collection(COLLECTIONS.users).doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('We could not find that student.');
    const user = snap.data() as User;

    const batch = db().batch();
    batch.update(ref, {
      status: 'active',
      suspendedReason: null,
      suspendedUntil: null,
      updatedAt: now(),
    });
    notify(batch, {
      uid,
      type: 'admin_notice',
      title: 'Your account is active again',
      body: 'You can post, list and rent as normal.',
      bookingId: '',
    });
    logAdminAction(batch, {
      admin,
      action: 'unsuspend_user',
      targetType: 'user',
      targetId: uid,
      notes: reason,
      before: { status: user.status, suspendedReason: user.suspendedReason },
      after: { status: 'active' },
    });
    await batch.commit();

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
    const { uid, note: rawNote } = request.data ?? {};
    if (!uid) throw invalidArgument('Which student?');
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
