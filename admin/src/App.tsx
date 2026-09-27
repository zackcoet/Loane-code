import { useAdminAuth } from './auth/useAdminAuth';
import { BrandVariables } from './components/BrandVariables';
import { Dashboard } from './pages/Dashboard';
import { SignIn } from './pages/SignIn';

export function App() {
  const { user, isAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <>
        <BrandVariables />
        <main className="app-loading">Loading…</main>
      </>
    );
  }

  // Signed in but not an admin: say so rather than showing an empty shell.
  if (!user || !isAdmin) {
    return (
      <>
        <BrandVariables />
        <SignIn rejected={Boolean(user) && !isAdmin} />
      </>
    );
  }

  return (
    <>
      <BrandVariables />
      <Dashboard adminEmail={user.email} />
    </>
  );
}
