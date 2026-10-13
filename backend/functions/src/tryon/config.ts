/**
 * The on/off switch, at `config/tryOn`.
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
import { COLLECTIONS, type TryOnConfig } from '@loane/shared';
import { db } from '../lib/admin';
import { failed } from '../lib/errors';

/** Off unless the document says otherwise. A missing config is not an open door. */
export async function readTryOnConfig(): Promise<TryOnConfig> {
  const snap = await db().collection(COLLECTIONS.config).doc('tryOn').get();
  const data = snap.data() as Partial<TryOnConfig> | undefined;
  return {
    enabled: data?.enabled ?? false,
    enabledForAdmins: data?.enabledForAdmins ?? true,
    updatedAt: data?.updatedAt ?? 0,
    updatedBy: data?.updatedBy ?? null,
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
 * looks like the app being broken rather than a missing secret. Turn
 * it on from the admin dashboard once RESEND_API_KEY is set and a test
 * code has actually arrived.
 */
export async function verificationRequired(): Promise<boolean> {
  const snap = await db().collection(COLLECTIONS.config).doc('verification').get();
  return (snap.data() as { required?: boolean } | undefined)?.required ?? false;
}
