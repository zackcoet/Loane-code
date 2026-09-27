import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { brand, COLLECTIONS, type Report, type User } from '@loane/shared';
import { db, now } from '../lib/admin';
import { failed, invalidArgument, notFound } from '../lib/errors';
import { logAdminAction, requireAdminContext, requireReason } from './audit';
import { notify } from '../bookings/transitions';

/**
 * Working a report.
 *
 * `reviewing` is a claim: it says an admin has picked this one up, so
 * two people are not both writing to the same student about it.
 *
 * ACTING AND RESOLVING ARE ONE CALL on purpose. If a report says "this
 * listing is counterfeit", you should be able to take the listing down,
 * suspend the seller and close the report in one action — and get three
 * correctly linked audit rows out of it. Making that three separate
 * clicks is how moderation ends up half-finished.
 */

type Action = 'none' | 'content_removed' | 'user_warned' | 'user_suspended' | 'user_removed';

interface ResolveInput {
  reportId: string;
  /** 'reviewing' to claim it; the others close it. */
  status: 'reviewing' | 'actioned' | 'dismissed';
  action?: Action;
  notes: string;
}

export const resolveReport = onCall<ResolveInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { reportId, status, action = 'none', notes: rawNotes } = request.data ?? {};
    if (!reportId) throw invalidArgument('Which report?');
    if (!['reviewing', 'actioned', 'dismissed'].includes(status)) {
      throw invalidArgument('Pick what is happening to this report.');
    }
    const notes = requireReason(rawNotes, 'Write what you found. Future-you will want it.');

    const ref = db().collection(COLLECTIONS.reports).doc(reportId);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('We could not find that report.');

    const report = snap.data() as Report;
    if (report.status === 'actioned' || report.status === 'dismissed') {
      throw failed('That report is already closed.');
    }

    const batch = db().batch();

    batch.update(ref, {
      status,
      resolution: {
        adminUid: admin.uid,
        action: status === 'reviewing' ? null : action,
        notes,
        resolvedAt: status === 'reviewing' ? null : now(),
      },
      updatedAt: now(),
    });
    logAdminAction(batch, {
      admin,
      action: `report_${status}`,
      targetType: 'report',
      targetId: reportId,
      notes,
      before: { status: report.status },
      after: { status, action },
    });

    // --- Carry out the action, in the same commit --------------------
    if (status === 'actioned' && action !== 'none') {
      if (action === 'content_removed') {
        const collection =
          report.targetType === 'listing'
            ? COLLECTIONS.listings
            : report.targetType === 'post'
              ? COLLECTIONS.posts
              : null;

        if (!collection) {
          throw failed('That kind of report has no content to remove.');
        }

        const targetRef = db().collection(collection).doc(report.targetId);
        const targetSnap = await targetRef.get();
        if (!targetSnap.exists) throw notFound('That content is already gone.');

        batch.update(targetRef, {
          status: 'suspended',
          suspendedReason: notes,
          updatedAt: now(),
        });
        logAdminAction(batch, {
          admin,
          action: `hide_${report.targetType}`,
          targetType: report.targetType,
          targetId: report.targetId,
          notes: `From report ${reportId}: ${notes}`,
        });
      }

      if (action === 'user_suspended' || action === 'user_warned') {
        if (!report.targetUid) throw failed('This report has no student attached.');

        const userRef = db().collection(COLLECTIONS.users).doc(report.targetUid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) throw notFound('We could not find that student.');

        const user = userSnap.data() as User;
        if (report.targetUid === admin.uid) throw failed("You can't action yourself.");
        if (user.role === 'admin') throw failed('Admins cannot be suspended from here.');

        if (action === 'user_suspended') {
          batch.update(userRef, {
            status: 'suspended',
            suspendedReason: notes,
            updatedAt: now(),
          });
          logAdminAction(batch, {
            admin,
            action: 'suspend_user',
            targetType: 'user',
            targetId: report.targetUid,
            notes: `From report ${reportId}: ${notes}`,
            before: { status: user.status },
            after: { status: 'suspended' },
          });
        }

        notify(batch, {
          uid: report.targetUid,
          type: 'admin_notice',
          title:
            action === 'user_suspended' ? 'Your account is suspended' : 'A warning from Loane',
          body: `${notes} Write to ${brand.supportEmail} if you think this is wrong.`,
          bookingId: '',
        });
      }
    }

    await batch.commit();
    logger.info('Report resolved', { reportId, status, action, by: admin.uid });
    return { ok: true };
  },
);
