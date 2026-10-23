/**
 * Is the phone online?
 *
 * One listener for the whole app, started on import. Screens use
 * `useIsOffline()`; code outside React (error messages, the save
 * helpers) reads `isOffline()`.
 *
 * Why it matters: with no signal, a Firestore save does not fail — it
 * waits, silently, until the signal comes back. A spinner that never
 * ends is worse than a clear "no internet", so every save she starts by
 * tapping a button checks here first (`assertOnline`).
 */

import { useSyncExternalStore } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { OFFLINE_MESSAGE, isOfflineState } from '@loane/shared';

let offline = false;
const listeners = new Set<() => void>();

NetInfo.addEventListener((state) => {
  const next = isOfflineState(state);
  if (next === offline) return;
  offline = next;
  listeners.forEach((fn) => fn());
});

export function isOffline(): boolean {
  return offline;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribe, isOffline, isOffline);
}

/**
 * An error shaped like Firebase's own "unavailable", so every existing
 * error message (saveErrorMessage, callableErrorMessage) already knows
 * to call it a connection problem.
 */
export class OfflineError extends Error {
  readonly code = 'unavailable';
  constructor() {
    super(OFFLINE_MESSAGE);
    this.name = 'OfflineError';
  }
}

/** Throws straight away when offline, instead of letting a save hang. */
export function assertOnline(): void {
  if (offline) throw new OfflineError();
}
