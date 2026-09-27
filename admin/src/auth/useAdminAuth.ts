/**
 * Admin sign-in state.
 *
 * Admin is a Firebase **custom claim**, not a database field — a field is
 * something someone might eventually find a way to write. We read the claim
 * off the ID token.
 *
 * This check is only a nice error message. The real lock is in the security
 * rules, which check the same claim independently. Someone bypassing this
 * screen would still be refused by the database.
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase/config';

export interface AdminAuthState {
  user: FirebaseUser | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useAdminAuth(): AdminAuthState {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      // force-refresh so a claim granted moments ago is picked up.
      const token = await next.getIdTokenResult(true);
      setIsAdmin(token.claims.admin === true);
      setLoading(false);
    });
  }, []);

  return { user, isAdmin, loading };
}
