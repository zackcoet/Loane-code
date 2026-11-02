/**
 * Does this student still have to prove her school email?
 *
 * TWO CONDITIONS, AND BOTH HAVE TO BE TRUE: the switch is on, and she
 * has not confirmed. The switch lives in Firestore at
 * `config/verification` rather than in the app, so it can be turned
 * off from the admin dashboard in seconds if email breaks — without
 * shipping a build to the App Store, which is the difference between
 * an outage of minutes and one of days.
 *
 * WHILE WE DO NOT KNOW, NOBODY IS BLOCKED. The config read can be
 * slow, fail, or be offline. Defaulting to "verification required"
 * when we have not heard back would put a student who is already
 * confirmed in front of a code screen because the network hiccuped.
 * The server is the real gate: every function that matters calls
 * requireVerifiedStudent, and the security rules check emailConfirmed
 * themselves. This hook only decides where to point her.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';

export function useVerificationGate() {
  const { profile } = useAuth();
  const [required, setRequired] = useState<boolean | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, COLLECTIONS.config, 'verification'),
        (snap) => setRequired(Boolean(snap.data()?.required)),
        // A read that fails is "we do not know", which is not "yes".
        () => setRequired(false),
      ),
    [],
  );

  return {
    /** Still deciding. Routing should wait rather than guess. */
    loading: required === null,
    mustVerify: required === true && profile !== null && profile.emailConfirmed !== true,
  };
}
