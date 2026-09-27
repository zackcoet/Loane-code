import { useEffect, useMemo, useState } from 'react';
import type { Campus, User } from '@loane/shared';
import type { AdminData, DateRangeKey } from '../data/adminData';
import {
  downloadCsv,
  formatDate,
  formatShortDate,
  getDateWindow,
  isInWindow,
  matchesCampus,
  toDate,
} from '../data/adminData';
import { CampusSelect, EmptyState, Pagination, Panel, Pill, Toolbar } from '../components/ui';

type SortKey = 'name' | 'createdAt' | 'lastActiveAt' | 'listings' | 'posts' | 'rentals';

const PAGE_SIZE = 25;

interface Props {
  data: AdminData;
  campusId: string;
  onCampusChange: (value: string) => void;
  onSelectUser: (uid: string) => void;
}

export function UsersPage({ data, campusId, onCampusChange, onSelectUser }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [joined, setJoined] = useState<DateRangeKey>('all');
  const [sort, setSort] = useState<SortKey>('createdAt');
  const [page, setPage] = useState(0);
  const joinedWindow = useMemo(() => getDateWindow(joined), [joined]);

  useEffect(() => setPage(0), [campusId, joined, query, sort, status]);

  const users = useMemo(() => {
    return data.users
      .filter((user) => matchesCampus(user, campusId))
      .filter((user) => status === 'all' || user.status === status)
      .filter((user) => joined === 'all' || isInWindow(user.createdAt, joinedWindow))
      .filter((user) => {
        const text = `${user.displayName} ${user.username} ${user.campusEmail ?? ''}`.toLowerCase();
        return text.includes(query.toLowerCase().trim());
      })
      .sort((a, b) => sortUsers(a, b, sort));
  }, [campusId, data.users, joined, joinedWindow, query, sort, status]);

  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const pageUsers = users.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportUsers = () => {
    downloadCsv(
      'loane-users.csv',
      users.map((user) => ({
        name: user.displayName,
        username: user.username,
        schoolEmail: user.campusEmail,
        campus: campusName(data.campuses, user.campusId),
        signupDate: formatDate(user.createdAt),
        lastActive: formatDate(user.lastActiveAt),
        listings: user.stats.listingCount,
        posts: user.stats.postCount,
        rentals: user.stats.rentalsAsLender + user.stats.rentalsAsRenter,
        status: user.status,
        emailConfirmed: user.verificationMethod === 'email_confirmed' ? 'yes' : 'no',
      })),
    );
  };

  return (
    <>
      <Toolbar>
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, username, or school email"
        />
        <CampusSelect campuses={data.campuses} value={campusId} onChange={onCampusChange} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <select value={joined} onChange={(event) => setJoined(event.target.value as DateRangeKey)}>
          <option value="all">Any join date</option>
          <option value="7d">Joined last 7 days</option>
          <option value="30d">Joined last 30 days</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="createdAt">Newest</option>
          <option value="lastActiveAt">Recently active</option>
          <option value="name">Name</option>
          <option value="listings">Listings</option>
          <option value="posts">Posts</option>
          <option value="rentals">Rentals</option>
        </select>
        <button className="outline-button" onClick={exportUsers}>
          Export CSV
        </button>
      </Toolbar>

      <Panel title="Accounts" kicker={`${users.length.toLocaleString()} loaded and filtered`}>
        {pageUsers.length > 0 ? (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>@username</th>
                  <th>School email</th>
                  <th>Campus</th>
                  <th>Signup</th>
                  <th>Last active</th>
                  <th>Listings</th>
                  <th>Posts</th>
                  <th>Rentals</th>
                  <th>Status</th>
                  <th>Email confirmed</th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map((user) => (
                  <tr key={user.uid} className="clickable-row" onClick={() => onSelectUser(user.uid)}>
                    <td>{user.displayName}</td>
                    <td>@{user.username}</td>
                    <td>{user.campusEmail ?? 'Not recorded'}</td>
                    <td>{campusName(data.campuses, user.campusId)}</td>
                    <td>{formatShortDate(user.createdAt)}</td>
                    <td>{formatShortDate(user.lastActiveAt)}</td>
                    <td>{user.stats.listingCount}</td>
                    <td>{user.stats.postCount}</td>
                    <td>{user.stats.rentalsAsLender + user.stats.rentalsAsRenter}</td>
                    <td>
                      <Pill tone={user.status === 'active' ? 'good' : 'warn'}>{user.status}</Pill>
                    </td>
                    <td>{user.verificationMethod === 'email_confirmed' ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageCount={pageCount} total={users.length} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="No users match"
            body="Try clearing a filter. Phase 1 account activity will make this list more useful."
          />
        )}
      </Panel>
    </>
  );
}

export function campusName(campuses: Campus[], campusId: string) {
  return campuses.find((campus) => campus.id === campusId)?.name ?? campusId;
}

function sortUsers(a: User, b: User, sort: SortKey) {
  if (sort === 'name') return a.displayName.localeCompare(b.displayName);
  if (sort === 'listings') return b.stats.listingCount - a.stats.listingCount;
  if (sort === 'posts') return b.stats.postCount - a.stats.postCount;
  if (sort === 'rentals') {
    return (
      b.stats.rentalsAsLender +
      b.stats.rentalsAsRenter -
      (a.stats.rentalsAsLender + a.stats.rentalsAsRenter)
    );
  }
  return (toDate(b[sort])?.getTime() ?? 0) - (toDate(a[sort])?.getTime() ?? 0);
}
