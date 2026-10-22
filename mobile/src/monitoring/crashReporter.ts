/**
 * Crash and error reporting — wired in, switched OFF.
 *
 * NORTH_STAR C7: the app is ready for a crash reporter (Sentry, say), but
 * signing up for one is Zack's call, so nothing here sends anything
 * anywhere. Every caller already goes through these three functions, so
 * switching one on later touches THIS FILE ONLY:
 *
 *   1. `npx expo install @sentry/react-native` (needs a development build,
 *      not Expo Go — same as push notifications).
 *   2. Set ENABLED to true and call `Sentry.init({ dsn })` in `start`.
 *   3. Forward `captureError` / `setReporterUser` to Sentry.
 *
 * Privacy rule for whoever turns it on: the student is identified by her
 * uid ONLY. Never her email, name, username, messages or photos — the App
 * Store privacy form (G4) would have to declare them otherwise.
 */

/** Off until Zack picks a provider. See docs/production-ops.md. */
export const CRASH_REPORTING_ENABLED = false;

type Context = Record<string, string | number | boolean | null | undefined>;

let started = false;

/** Called once at launch. A no-op while reporting is off. */
export function startCrashReporter(): void {
  if (started) return;
  started = true;
  if (!CRASH_REPORTING_ENABLED) return;
  // Provider init goes here.
}

/** Ties future reports to a student by uid, or clears it on sign-out. */
export function setReporterUser(uid: string | null): void {
  if (!CRASH_REPORTING_ENABLED) return;
  void uid;
  // Provider setUser({ id: uid }) goes here.
}

/**
 * Something broke that we want to hear about. Safe to call anywhere:
 * it never throws, so reporting a crash can never cause one.
 */
export function captureError(error: unknown, context: Context = {}): void {
  try {
    if (__DEV__) {
      console.warn('[crash-reporter]', context.where ?? 'error', error);
    }
    if (!CRASH_REPORTING_ENABLED) return;
    // Provider captureException(error, { extra: context }) goes here.
  } catch {
    // Never let the reporter itself become the crash.
  }
}
