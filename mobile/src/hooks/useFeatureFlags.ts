/**
 * The switchboard, `config/features`, read live.
 *
 * The app only HIDES things with this. Every switch is checked again on
 * the server, so a phone that is stale or tampered with still gets
 * refused. See shared/src/featureFlags.ts for what each switch means.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  COLLECTIONS,
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAGS_DOC,
  resolveFeatureFlags,
  type FeatureFlags,
} from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useFeatureFlags(): FeatureFlags {
  const { profile } = useAuth();
  // Until the document arrives, assume today's defaults: nothing risky
  // flashes on screen, and same-day doesn't flicker off and on.
  const [flags, setFlags] = useState<FeatureFlags>(FEATURE_FLAG_DEFAULTS);

  useEffect(() => {
    // The rules only let a signed-in student read config.
    if (!profile) return;
    return onSnapshot(
      doc(db, COLLECTIONS.config, FEATURE_FLAGS_DOC),
      (snap) => setFlags(resolveFeatureFlags(snap.data())),
      // Unreadable is not an open door: fall back to the defaults.
      () => setFlags(FEATURE_FLAG_DEFAULTS),
    );
  }, [profile?.uid]);

  return flags;
}
