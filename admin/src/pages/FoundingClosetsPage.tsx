import type { AdminData } from '../data/adminData';
import { formatShortDate, matchesCampus } from '../data/adminData';
import { EmptyState, Panel } from '../components/ui';
import { campusName } from './UsersPage';

export function FoundingClosetsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const founders = data.users
    .filter((user) => user.isFoundingCloset)
    .filter((user) => matchesCampus(user, campusId))
    .sort((a, b) => b.stats.listingCount - a.stats.listingCount);

  return (
    <Panel title="Founding Closets" kicker={`${founders.length} loaded accounts`}>
      {founders.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>@username</th>
              <th>Campus</th>
              <th>Items listed</th>
              <th>Posts</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {founders.map((user) => (
              <tr key={user.uid}>
                <td>{user.displayName}</td>
                <td>@{user.username}</td>
                <td>{campusName(data.campuses, user.campusId)}</td>
                <td>{user.stats.listingCount}</td>
                <td>{user.stats.postCount}</td>
                <td>{formatShortDate(user.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          title="No founding closets yet"
          body="Phase 1 account management will mark launch closets, then their inventory count appears here."
        />
      )}
    </Panel>
  );
}
