/**
 * Holds what she types across the onboarding screens.
 *
 * Onboarding collects her first name before the account exists, then her
 * campus email, then her username, and only submits everything at the end
 * in one call to `completeSignup`.
 *
 * This is PERSISTED to device storage, not just held in memory. That matters:
 * the Firebase Auth account is created partway through onboarding, so if the
 * app reloads between "create account" and "claim username", an in-memory
 * draft would come back empty and `completeSignup` would reject the submit
 * with "Enter a name" — a dead end she could never get out of. Persisting
 * the draft means a reload picks up where she left off.
 *
 * It is cleared as soon as signup completes.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'loane.signupDraft.v1';

interface SignupDraft {
  firstName: string;
  campusEmail: string;
}

interface SignupDraftState extends SignupDraft {
  setFirstName: (value: string) => void;
  setCampusEmail: (value: string) => void;
  reset: () => void;
  /** False until the saved draft has been read back from storage. */
  hydrated: boolean;
}

const SignupDraftContext = createContext<SignupDraftState | null>(null);

export function SignupDraftProvider({ children }: { children: React.ReactNode }) {
  const [firstName, setFirstNameState] = useState('');
  const [campusEmail, setCampusEmailState] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const saved = JSON.parse(raw) as Partial<SignupDraft>;
        setFirstNameState(saved.firstName ?? '');
        setCampusEmailState(saved.campusEmail ?? '');
      })
      .catch(() => {
        // A missing or corrupt draft is not an error — she just starts over.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Write through on every change so a reload never loses a step.
  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ firstName, campusEmail })).catch(
      () => {},
    );
  }, [firstName, campusEmail, hydrated]);

  const value = useMemo<SignupDraftState>(
    () => ({
      firstName,
      campusEmail,
      hydrated,
      setFirstName: setFirstNameState,
      setCampusEmail: setCampusEmailState,
      reset: () => {
        setFirstNameState('');
        setCampusEmailState('');
        void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      },
    }),
    [firstName, campusEmail, hydrated],
  );

  return <SignupDraftContext.Provider value={value}>{children}</SignupDraftContext.Provider>;
}

export function useSignupDraft(): SignupDraftState {
  const ctx = useContext(SignupDraftContext);
  if (!ctx) throw new Error('useSignupDraft must be used inside SignupDraftProvider');
  return ctx;
}
