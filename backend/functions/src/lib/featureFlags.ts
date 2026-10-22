/**
 * Reading and changing the switchboard, `config/features`.
 *
 * Every server-side feature check reads through here, so there is one
 * place that knows where the switches live and what a missing one means.
 * The meaning of each flag, and its default, is in
 * shared/src/featureFlags.ts.
 */

import {
  COLLECTIONS,
  FEATURE_FLAG_INFO,
  FEATURE_FLAGS_DOC,
  featureFlagChangeRefusal,
  resolveFeatureFlags,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@loane/shared';
import { db, now } from './admin';
import { failed } from './errors';
import { logAdminAction, type AdminContext } from '../admin/audit';

function featuresRef() {
  return db().collection(COLLECTIONS.config).doc(FEATURE_FLAGS_DOC);
}

/** The flags in force. A missing document is today's defaults, never an open door. */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const snap = await featuresRef().get();
  return resolveFeatureFlags(snap.data());
}

/** Refuses with a plain sentence when a feature is switched off. */
export async function assertFeatureOn(key: FeatureFlagKey, message?: string): Promise<void> {
  const flags = await getFeatureFlags();
  if (flags[key]) return;
  throw failed(message ?? `${FEATURE_FLAG_INFO[key].label} is switched off right now.`);
}

/**
 * Changes flags, with one audit row. Used by the dashboard's switchboard
 * and by the older try-on switch, so both leave the same trail.
 */
export async function writeFeatureFlags(
  admin: AdminContext,
  changes: Partial<FeatureFlags>,
  reason: string,
): Promise<void> {
  for (const [key, value] of Object.entries(changes) as [FeatureFlagKey, boolean][]) {
    const refusal = featureFlagChangeRefusal(key, value);
    if (refusal) throw failed(`${FEATURE_FLAG_INFO[key].label} can't be turned on yet. ${refusal}`);
  }

  const before = await getFeatureFlags();
  const batch = db().batch();
  batch.set(featuresRef(), { ...changes, updatedAt: now(), updatedBy: admin.uid }, { merge: true });

  const changedBefore: Partial<FeatureFlags> = {};
  for (const key of Object.keys(changes) as FeatureFlagKey[]) changedBefore[key] = before[key];

  logAdminAction(batch, {
    admin,
    action: 'feature_flag_changed',
    targetType: 'config',
    targetId: FEATURE_FLAGS_DOC,
    notes: reason,
    before: changedBefore,
    after: changes,
  });

  await batch.commit();
}
