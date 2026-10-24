import { campusDemand, type Campus } from '@loane/shared';
import { EmptyState, MiniStat, Panel } from '../components/ui';

export function CampusesPage({ campuses }: { campuses: Campus[] }) {
  return (
    <>
      <OtherSchools campuses={campuses} />
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
    </>
  );
}

/**
 * Sign-ups from schools Loane has not launched at — the demand signal for
 * picking the next campus. Counts are the server-kept student counts.
 */
function OtherSchools({ campuses }: { campuses: Campus[] }) {
  const { rows, totalStudents } = campusDemand(campuses);
  return (
    <Panel kicker="Next campus" title="Sign-ups from other schools">
      {rows.length === 0 ? (
        <EmptyState
          title="None yet"
          body="Nobody outside the University of South Carolina has signed up. When they do, their school shows here."
        />
      ) : (
        <>
          <p className="muted">
            {totalStudents.toLocaleString()} {totalStudents === 1 ? 'student' : 'students'} from{' '}
            {rows.length} other {rows.length === 1 ? 'school' : 'schools'}, most first.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>School</th>
                <th>Email</th>
                <th>Students</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className="muted">{row.domains.join(' · ')}</td>
                  <td>{row.students.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
