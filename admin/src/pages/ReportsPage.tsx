import type { AdminData } from '../data/adminData';
import { formatShortDate, humanize, matchesCampus } from '../data/adminData';
import { EmptyState, Panel } from '../components/ui';

export function ReportsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const reports = data.reports.filter((report) => matchesCampus(report, campusId));
  return (
    <Panel title="Reports Queue" kicker={`${reports.length} loaded reports`}>
      {reports.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Target</th>
              <th>Reason</th>
              <th>Details</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.status}</td>
                <td>{report.targetType}</td>
                <td>{humanize(report.reason)}</td>
                <td>{report.details}</td>
                <td>{formatShortDate(report.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          title="No reports yet"
          body="Phase 6 trust tools will send flagged users, listings, posts, bookings, and messages here."
        />
      )}
    </Panel>
  );
}
