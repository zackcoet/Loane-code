import { useAdminAuth } from './auth/useAdminAuth';
import { Dashboard } from './pages/Dashboard';
import { SignIn } from './pages/SignIn';

export function App() {
  const { user, isAdmin, loading } = useAdminAuth();

  if (loading) {
    return <main className="app-loading">Loading…</main>;
  }

  // Signed in but not an admin: say so rather than showing an empty shell.
  if (!user || !isAdmin) return <SignIn rejected={Boolean(user) && !isAdmin} />;

  return <Dashboard adminEmail={user.email} />;
}
