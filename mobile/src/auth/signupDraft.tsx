/**
 * Holds what she types across the onboarding screens.
 *
 * Onboarding collects a first name, then a school email and password, then
 * a username — and only at the very end does it call `createAccount`,
 * which builds the login and the profile together on the server.
 *
 * TWO DIFFERENT STORAGE RULES HERE, on purpose:
 *
 *   firstName / campusEmail  persisted to the device, so a reload mid-signup
 *                            does not lose her progress.
 *   password                 memory only. A password never goes to disk.
 *
 * So if the app reloads between the email screen and the username screen,
 * everything survives except the password, and the username screen sends
 * her back one step to retype it. Rare, and the safe trade.
 *
 * The whole draft is cleared the moment signup succeeds.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'loane.signupDraft.v2';

interface PersistedDraft {
  firstName: string;
  campusEmail: string;
}

interface SignupDraftState extends PersistedDraft {
  setFirstName: (value: string) => void;
  setCampusEmail: (value: string) => void;
  /** Memory only — never written to disk. */
  getPassword: () => string;
  setPassword: (value: string) => void;
  hasPassword: boolean;
  reset: () => void;
  /** False until the saved draft has been read back from storage. */
  hydrated: boolean;
}

const SignupDraftContext = createContext<SignupDraftState | null>(null);

export function SignupDraftProvider({ children }: { children: React.ReactNode }) {
  const [firstName, setFirstName] = useState('');
  const [campusEmail, setCampusEmail] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  // A ref, not state: it must never end up serialized anywhere.
  const password = useRef('');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const saved = JSON.parse(raw) as Partial<PersistedDraft>;
        setFirstName(saved.firstName ?? '');
        setCampusEmail(saved.campusEmail ?? '');
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
      hasPassword,
      setFirstName,
      setCampusEmail,
      getPassword: () => password.current,
      setPassword: (value: string) => {
        password.current = value;
        setHasPassword(value.length > 0);
      },
      reset: () => {
        setFirstName('');
        setCampusEmail('');
        password.current = '';
        setHasPassword(false);
        void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      },
    }),
    [firstName, campusEmail, hydrated, hasPassword],
  );

  return <SignupDraftContext.Provider value={value}>{children}</SignupDraftContext.Provider>;
}

export function useSignupDraft(): SignupDraftState {
  const ctx = useContext(SignupDraftContext);
  if (!ctx) throw new Error('useSignupDraft must be used inside SignupDraftProvider');
  return ctx;
}
