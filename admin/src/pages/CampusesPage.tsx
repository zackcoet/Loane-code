import type { Campus } from '@loane/shared';
import { EmptyState, MiniStat } from '../components/ui';

export function CampusesPage({ campuses }: { campuses: Campus[] }) {
  return (
    <section className="card-grid">
      {campuses.map((campus) => (
        <article key={campus.id} className="panel">
          <p className="label">{campus.isLive ? 'Live campus' : 'Not live'}</p>
          <h2>{campus.name}</h2>
          <p className="muted">{campus.emailDomains.join(' · ')}</p>
          <div className="campus-stats">
            <MiniStat label="Users" value={campus.stats.userCount} />
            <MiniStat label="Listings" value={campus.stats.listingCount} />
            <MiniStat label="Posts" value={campus.stats.postCount} />
            <MiniStat label="Bookings" value={campus.stats.bookingCount} />
          </div>
        </article>
      ))}
      {campuses.length === 0 ? (
        <EmptyState title="No campuses yet" body="Run the seed script to add the University of South Carolina." />
      ) : null}
    </section>
  );
}
