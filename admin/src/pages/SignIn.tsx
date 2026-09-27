/**
 * Admin sign-in.
 *
 * Refuses anyone without the admin custom claim, and says so plainly rather
 * than dumping a Firebase error code.
 */

import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { brand, color, fontSize, normalizeEmail, validateEmail } from '@loane/shared';
import { auth } from '../firebase/config';

function friendlyAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'That email and password do not match.';
      case 'auth/too-many-requests':
        return 'Too many tries. Wait a minute and try again.';
      default:
        break;
    }
  }
  return 'Something went wrong. Try again.';
}

interface Props {
  /** True when a real account signed in but is not an admin. */
  rejected: boolean;
}

export function SignIn({ rejected }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const check = validateEmail(email);
    if (!check.ok) return setError(check.error ?? null);

    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  if (rejected) {
    return (
      <main style={styles.wrapper}>
        <div style={styles.panel} className="card">
          <p className="label">Loane Admin</p>
          <h1 style={styles.heading}>This account isn&apos;t an admin.</h1>
          <p style={styles.body}>
            Admin access is granted by the team, not requested here. If you think this is a
            mistake, contact {brand.supportEmail}.
          </p>
          <button className="link" onClick={() => signOut(auth)} style={{ marginTop: 24 }}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.wrapper}>
      <form style={styles.panel} className="card" onSubmit={onSubmit}>
        <p className="label">Loane Admin</p>
        <h1 style={styles.heading}>Sign in.</h1>

        <div style={{ marginBottom: 24 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 32 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />
          {error ? <p className="error">{error}</p> : null}
        </div>

        <button className="primary" type="submit" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: color.surface.page,
  },
  panel: { width: '100%', maxWidth: 380 },
  heading: { fontSize: fontSize['2xl'], fontWeight: 700, margin: '8px 0 32px' },
  body: { fontSize: fontSize.sm, color: color.text.secondary, marginTop: 8 },
};
