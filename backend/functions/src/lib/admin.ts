import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * The Admin SDK bypasses security rules entirely. That is the point: this
 * code runs on Google's servers where nobody can edit it, so it is the only
 * place allowed to write bookings, counters, verification flags and roles.
 */

let app: App | undefined;

function ensureApp(): App {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp();
  }
  return app;
}

export const db = () => getFirestore(ensureApp());
export const auth = () => getAuth(ensureApp());
export { FieldValue, Timestamp };

/** Server timestamp, for `createdAt` / `updatedAt`. */
export const now = () => FieldValue.serverTimestamp();
