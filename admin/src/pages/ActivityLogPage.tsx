import type { AdminData } from '../data/adminData';
import { formatDate, toDate } from '../data/adminData';
import { EmptyState, Panel } from '../components/ui';

export function ActivityLogPage({ data }: { data: AdminData }) {
  const actions = [...data.adminActions].sort(
    (a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0),
  );

  return (
    <Panel title="Activity Log" kicker={`${actions.length} loaded admin actions`}>
      {actions.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id}>
                <td>{formatDate(action.createdAt)}</td>
                <td>{action.adminUid}</td>
                <td>{action.action}</td>
                <td>
                  {action.targetType} · {action.targetId}
                </td>
                <td>{action.notes ?? 'No notes'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          title="No admin actions yet"
          body="Once moderation Cloud Functions exist, suspend, hide, and resolve actions will be recorded here."
        />
      )}
    </Panel>
  );
}
