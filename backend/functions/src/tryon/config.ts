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
  throw failed('Try-on is not available yet.');
}
