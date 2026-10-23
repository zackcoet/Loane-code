/**
 * Telling "this doesn't exist" apart from "we couldn't ask".
 *
 * With no signal, Firestore answers a single-document listener from its
 * local cache. The app keeps no cache between launches, so the answer
 * is "no such document" — flagged `fromCache`. Taken at face value
 * that sent a signed-in student opening Loane on the subway to the
 * create-account screen (her profile "didn't exist"), and turned every
 * look and piece into "This look isn't here".
 *
 * Only the server can say a document is gone. A cached "missing" means
 * unknown, and screens keep loading (with the offline bar showing)
 * until the server answers.
 */

export type DocPresence = 'present' | 'missing' | 'unknown';

export function docPresence(exists: boolean, fromCache: boolean): DocPresence {
  if (exists) return 'present';
  return fromCache ? 'unknown' : 'missing';
}

/**
 * Whether the phone is offline, from what the network library reports.
 *
 * `isInternetReachable` is null until the phone has checked, and null
 * must not count as offline — that would flash the bar on every launch.
 * Only a definite "no" does.
 */
export function isOfflineState(state: {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

/** The one sentence for "the request never got to Loane". */
export const OFFLINE_MESSAGE = 'No internet connection. Check your signal and try again.';
