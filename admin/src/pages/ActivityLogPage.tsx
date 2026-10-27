import { adminActionLabel, adminTargetLabel, reportPersonLabel } from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatDate, toDate } from '../data/adminData';
import { EmptyState, Panel } from '../components/ui';
import { PersonLink } from '../components/PersonLink';

/**
 * Every admin action, newest first, in words.
 *
 * Rows store account ids, never a copy of a name, so who did it and who
 * it was done to are looked up live: a renamed student shows her name
 * today and a deleted one says "Deleted account", never an old handle
 * someone else may now own. The row itself is never edited — it is an
 * append-only audit log.
 */
export function ActivityLogPage({
  data,
  onOpenUser,
}: {
  data: AdminData;
  /** Opens her page under Users. */
  onOpenUser: (uid: string) => void;
}) {
  const actions = [...data.adminActions].sort(
    (a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0),
  );

  return (
    <Panel title="Activity Log" kicker={`Latest ${actions.length} admin actions`}>
      {actions.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>On</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id}>
                <td>{formatDate(action.createdAt)}</td>
                <td>{action.adminEmail ?? reportPersonLabel(action.adminUid, data.users).label}</td>
                <td>{adminActionLabel(action.action)}</td>
                <td>
                  {action.targetType === 'user' ? (
                    <PersonLink
                      person={reportPersonLabel(action.targetId, data.users)}
                      onOpen={onOpenUser}
                    />
                  ) : (
                    adminTargetLabel(action.targetType, action.targetId)
                  )}
                </td>
                <td>{action.notes ?? 'No notes'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          title="No admin actions yet"
          body="Every suspend, take-down, report decision and feature switch change will be listed here, with who did it and why."
        />
      )}
    </Panel>
  );
}
