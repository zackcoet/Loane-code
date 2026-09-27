/**
 * Holds what she types across the onboarding screens.
 *
 * Onboarding collects her first name before the account exists, then her
 * campus email, then her username, and only submits everything at the end
 * in one call. This keeps those answers in memory between screens.
 *
 * Deliberately NOT persisted: it is short-lived, and it briefly contains
 * things we do not want sitting on disk.
 */

import { createContext, useContext, useMemo, useState } from 'react';

interface SignupDraft {
  firstName: string;
  campusEmail: string;
}

interface SignupDraftState extends SignupDraft {
  setFirstName: (value: string) => void;
  setCampusEmail: (value: string) => void;
  reset: () => void;
}

const SignupDraftContext = createContext<SignupDraftState | null>(null);

export function SignupDraftProvider({ children }: { children: React.ReactNode }) {
  const [firstName, setFirstName] = useState('');
  const [campusEmail, setCampusEmail] = useState('');

  const value = useMemo<SignupDraftState>(
    () => ({
      firstName,
      campusEmail,
      setFirstName,
      setCampusEmail,
      reset: () => {
        setFirstName('');
        setCampusEmail('');
      },
    }),
    [firstName, campusEmail],
  );

  return <SignupDraftContext.Provider value={value}>{children}</SignupDraftContext.Provider>;
}

export function useSignupDraft(): SignupDraftState {
  const ctx = useContext(SignupDraftContext);
  if (!ctx) throw new Error('useSignupDraft must be used inside SignupDraftProvider');
  return ctx;
}
