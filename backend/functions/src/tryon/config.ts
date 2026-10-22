/**
 * The try-on on/off switch, now part of the switchboard at `config/features`.
 *
 * A switch rather than a deploy, because the first thing we will want
 * to do if a generation bill or a bad result shows up is turn it off in
 * ten seconds, not in a release.
 *
 * `enabledForAdmins` is what lets us use the real thing on the real
 * project before a single student can, which is the only honest way to
 * test it — the emulator does not call FASHN.
 */

import type { CallableRequest } from 'firebase-functions/v2/https';
import type { TryOnConfig } from '@loane/shared';
import { failed } from '../lib/errors';
import { getFeatureFlags } from '../lib/featureFlags';

/**
 * Off unless the switchboard says otherwise. A missing config is not an
 * open door. Since autopilot run 13 the switches live in
 * `config/features` (see shared/src/featureFlags.ts); the old
 * `config/tryOn` document is no longer read.
 */
export async function readTryOnConfig(): Promise<TryOnConfig> {
  const flags = await getFeatureFlags();
  return {
    enabled: flags.tryOn,
    enabledForAdmins: flags.tryOnAdminPreview,
    updatedAt: 0,
    updatedBy: null,
  };
}

export async function assertTryOnEnabled(request: CallableRequest): Promise<void> {
  const config = await readTryOnConfig();
  if (config.enabled) return;
  if (config.enabledForAdmins && request.auth?.token?.admin === true) return;

  /*
    Say WHICH off it is.

    "Try-on is not available yet" was true and useless: it reads the
    same whether the feature is deliberately dark for a campus, or
    whether somebody reseeded the emulator and silently lost the
    switch. The second cost an evening.
  */
  if (config.enabledForAdmins) {
    throw failed('Try-on is switched off for students right now. An admin can turn it on.');
  }
  throw failed('Try-on is switched off. An admin can turn it on from the dashboard.');
}

/**
 * Whether an unverified student is blocked.
 *
 * OFF UNTIL EMAIL WORKS. A required verification with no working email
 * service is a locked front door: nobody can sign up, and the failure
 * looks like the app being broken rather than a missing secret. The
 * switchboard refuses to turn it on until that lock is lifted in
 * shared/src/featureFlags.ts.
 */
export async function verificationRequired(): Promise<boolean> {
  return (await getFeatureFlags()).emailVerification;
}
