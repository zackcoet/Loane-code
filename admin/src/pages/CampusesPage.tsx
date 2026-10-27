import { campusDemand, type Campus } from '@loane/shared';
import { EmptyState, MiniStat, Panel } from '../components/ui';
import { useCampusCounts, type CampusCountsState } from '../data/campusCounts';

export function CampusesPage({ campuses }: { campuses: Campus[] }) {
  const counts = useCampusCounts(campuses);
  return (
    <>
      <OtherSchools campuses={campuses} />
      {counts.status === 'error' ? (
        <p className="muted">
          Couldn't count pieces, looks and rentals just now. Refresh the page to try again.
        </p>
      ) : null}
      <section className="card-grid">
        {campuses.map((campus) => (
          <article key={campus.id} className="panel">
            <p className="label">{campus.isLive ? 'Live campus' : 'Not live'}</p>
            <h2>{campus.name}</h2>
            <p className="muted">{campus.emailDomains.join(' · ')}</p>
            <div className="campus-stats">
              <MiniStat label="Students" value={Math.max(0, campus.stats?.userCount ?? 0)} />
              <CountStat label="Pieces" counts={counts} campusId={campus.id} pick="listings" />
              <CountStat label="Looks" counts={counts} campusId={campus.id} pick="posts" />
              <CountStat
                label="Rented or sold"
                counts={counts}
                campusId={campus.id}
                pick="completedBookings"
              />
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

/**
 * One live-counted number on a campus card. While counting (or if it
 * failed) it shows a dash, never a 0 that looks like a real answer.
 */
function CountStat({
  label,
  counts,
  campusId,
  pick,
}: {
  label: string;
  counts: CampusCountsState;
  campusId: string;
  pick: 'listings' | 'posts' | 'completedBookings';
}) {
  const value = counts.status === 'ready' ? counts.byCampus[campusId]?.[pick] : undefined;
  if (value === undefined) {
    return (
      <div>
        <strong>–</strong>
        <span className="label">{label}</span>
      </div>
    );
  }
  return <MiniStat label={label} value={value} />;
}
