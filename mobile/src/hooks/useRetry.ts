/**
 * A "Try again" for a live Firestore listener.
 *
 * A listener that errors is finished — Firestore never restarts it — so
 * retrying means opening a new one. Put `attempt` in the effect's
 * dependencies and call `retry` from the button.
 */

import { useCallback, useState } from 'react';

export function useRetry() {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { attempt, retry };
}
