/**
 * Who is signed in, and do they have a profile yet?
 *
 * Onboarding creates the Firebase Auth account partway through (at the
 * "Create your account" step) but the user profile document is not written
 * until the very end, by the `completeSignup` Cloud Function. So there is a
 * real state where someone is signed in but has no profile — she is
 * mid-onboarding. This provider exposes that distinction so the router can
 * put her back where she left off.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  COLLECTIONS,
  type User,
} from '@loane/shared';
import { auth, db } from '../firebase/config';
import { setAnalyticsCampus } from '../analytics/events';

interface AuthState {
  /** The Firebase Auth account, or null when signed out. */
  firebaseUser: FirebaseUser | null;
  /** The Loane profile, or null when signed out OR mid-onboarding. */
  profile: User | null;
  /** True until we know both of the above. Show a splash while true. */
  loading: boolean;
  /** Signed in but no profile yet — she needs to finish onboarding. */
  needsOnboarding: boolean;
}

const AuthContext = createContext<AuthState>({
  firebaseUser: null,
  profile: null,
  loading: true,
  needsOnboarding: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthResolved(true);
      if (!user) {
        setProfile(null);
        setProfileResolved(true);
        setAnalyticsCampus(null);
      } else {
        setProfileResolved(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    // Live subscription, so a profile created by completeSignup shows up
    // without the app having to poll or refresh.
    return onSnapshot(
      doc(db, COLLECTIONS.users, firebaseUser.uid),
      (snap) => {
        const next = snap.exists() ? (snap.data() as User) : null;
        setProfile(next);
        setAnalyticsCampus(next?.campusId ?? null);
        setProfileResolved(true);
      },
      () => {
        setProfile(null);
        setProfileResolved(true);
      },
    );
  }, [firebaseUser]);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      profile,
      loading: !authResolved || !profileResolved,
      needsOnboarding: Boolean(firebaseUser) && profile === null && profileResolved,
    }),
    [firebaseUser, profile, authResolved, profileResolved],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
