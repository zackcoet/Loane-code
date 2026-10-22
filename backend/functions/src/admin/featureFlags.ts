/**
 * The dashboard's switchboard: turn one feature on or off, with a reason.
 *
 * The security rules refuse every client write to `config/`, admin
 * included. A switch that can turn on spending, or lock every new student
 * out, is only flippable through here, and every flip leaves an audit row.
 */

import { logger } from 'firebase-functions';
import { onCall } from '../lib/callable';
import { isFeatureFlagKey, type FeatureFlagKey } from '@loane/shared';
import { invalidArgument } from '../lib/errors';
import { writeFeatureFlags } from '../lib/featureFlags';
import { requireAdminContext, requireReason } from './audit';

interface SetFeatureFlagInput {
  flag: FeatureFlagKey;
  value: boolean;
  reason: string;
}

export const setFeatureFlag = onCall<SetFeatureFlagInput, Promise<{ ok: true }>>(
  { region: 'us-central1' },
  async (request) => {
    const admin = requireAdminContext(request);
    const { flag, value, reason: rawReason } = request.data ?? {};

    if (!isFeatureFlagKey(flag)) throw invalidArgument('Which switch?');
    if (typeof value !== 'boolean') throw invalidArgument('On or off?');
    const reason = requireReason(rawReason, 'Why are you changing this?');

    await writeFeatureFlags(admin, { [flag]: value }, reason);
    logger.warn('Feature flag changed', { by: admin.uid, flag, value });
    return { ok: true };
  },
);
