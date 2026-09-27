/**
 * Overview.
 *
 * Phase 0 shows the live campus counters so there is something real to look
 * at and so we can confirm the admin gate works end to end. The metrics
 * that actually answer the two MVP questions are built in Phase 7.
 */

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { COLLECTIONS, colors, type Campus } from '@loane/shared';
import { auth, db } from '../firebase/config';

export function Overview({ email }: { email: string | null }) {
  const [campuses, setCampuses] = useState<Campus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, COLLECTIONS.campuses))
      .then((snap) => setCampuses(snap.docs.map((d) => d.data() as Campus)))
      .catch(() => setError('Could not load campuses. Are the emulators running?'));
  }, []);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span className="label">Loane Admin</span>
        <div style={styles.headerRight}>
          {email ? <span style={styles.email}>{email}</span> : null}
          <button className="link" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <h1 style={styles.heading}>Overview</h1>

        {error ? <p className="error">{error}</p> : null}
        {!campuses && !error ? <p style={styles.muted}>Loading…</p> : null}

        {campuses?.map((campus) => (
          <section key={campus.name} className="card" style={{ marginBottom: 16 }}>
            <p className="label">{campus.isLive ? 'Live campus' : 'Not live'}</p>
            <h2 style={styles.campusName}>{campus.name}</h2>
            <p style={styles.muted}>{campus.emailDomains.join(' · ')}</p>

            <div style={styles.statGrid}>
              <Stat label="Students" value={campus.stats.userCount} />
              <Stat label="Verified" value={campus.stats.verifiedUserCount} />
              <Stat label="Listings" value={campus.stats.listingCount} />
              <Stat label="Posts" value={campus.stats.postCount} />
              <Stat label="Bookings" value={campus.stats.bookingCount} />
            </div>
          </section>
        ))}

        {campuses?.length === 0 ? (
          <p style={styles.muted}>
            No campuses yet. Run the seed script to fill the emulator with test data.
          </p>
        ) : null}

        {/* TODO-PHASE7: user management, moderation queue, reports, damage
            claims, founding-closet tracker, and the engagement metrics that
            answer the two MVP questions. */}
        <p style={{ ...styles.muted, marginTop: 40 }}>
          User management, moderation and engagement metrics arrive in Phase 7.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div className="label" style={{ fontSize: 9 }}>
        {label}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: colors.white },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: `1px solid ${colors.border}`,
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  email: { fontSize: 13, color: colors.textSecondary },
  main: { maxWidth: 760, margin: '0 auto', padding: 32 },
  heading: { fontSize: 28, fontWeight: 700, marginBottom: 32 },
  campusName: { fontSize: 18, fontWeight: 600, margin: '8px 0 4px' },
  muted: { fontSize: 13, color: colors.textMuted },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
    border: `1px solid ${colors.border}`,
    marginTop: 24,
  },
  stat: { padding: '16px 8px', textAlign: 'center', borderRight: `1px solid ${colors.border}` },
  statValue: { fontSize: 20, fontWeight: 600 },
};
