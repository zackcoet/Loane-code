import { useEffect, useState } from 'react';
import type { User } from '@loane/shared';
import { AdminLayout } from '../components/AdminLayout';
import { Loading } from '../components/ui';
import { type AdminData, type DateRangeKey, loadAdminData } from '../data/adminData';
import { PAGE_LABELS, type Page } from '../types';
import { ActivityLogPage } from './ActivityLogPage';
import { CampusesPage } from './CampusesPage';
import { ClaimsPage } from './ClaimsPage';
import { FoundingClosetsPage } from './FoundingClosetsPage';
import { ListingsPage } from './ListingsPage';
import { OverviewPage } from './OverviewPage';
import { PostsPage } from './PostsPage';
import { RentalsPage } from './RentalsPage';
import { ReportsPage } from './ReportsPage';
import { UserDetailPage } from './UserDetailPage';
import { UsersPage } from './UsersPage';

export function Dashboard({ adminEmail }: { adminEmail: string | null }) {
  const [page, setPage] = useState<Page>('overview');
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');
  const [campusId, setCampusId] = useState('all');
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    loadAdminData()
      .then(setData)
      .catch(() => setError('Could not load admin data. Check that the emulators are running.'));
  }, []);

  const selectedUser = data?.users.find((user) => user.uid === selectedUserId) ?? null;
  const title = selectedUser ? selectedUser.displayName : PAGE_LABELS[page];

  return (
    <AdminLayout
      adminEmail={adminEmail}
      page={page}
      title={title}
      onPageChange={(nextPage) => {
        setPage(nextPage);
        if (nextPage !== 'users') setSelectedUserId(null);
      }}
    >
      {error ? <p className="error">{error}</p> : null}
      {!data && !error ? <Loading /> : null}
      {data ? (
        <main className="content">
          <CurrentPage
            data={data}
            page={page}
            selectedUser={selectedUser}
            dateRange={dateRange}
            campusId={campusId}
            onCampusChange={setCampusId}
            onDateRangeChange={setDateRange}
            onSelectUser={setSelectedUserId}
            onBackToUsers={() => setSelectedUserId(null)}
          />
        </main>
      ) : null}
    </AdminLayout>
  );
}

function CurrentPage({
  data,
  page,
  selectedUser,
  dateRange,
  campusId,
  onCampusChange,
  onDateRangeChange,
  onSelectUser,
  onBackToUsers,
}: {
  data: AdminData;
  page: Page;
  selectedUser: User | null;
  dateRange: DateRangeKey;
  campusId: string;
  onCampusChange: (value: string) => void;
  onDateRangeChange: (value: DateRangeKey) => void;
  onSelectUser: (uid: string) => void;
  onBackToUsers: () => void;
}) {
  if (page === 'overview') {
    return (
      <OverviewPage
        data={data}
        dateRange={dateRange}
        campusId={campusId}
        onDateRangeChange={onDateRangeChange}
        onCampusChange={onCampusChange}
      />
    );
  }
  if (page === 'users' && selectedUser) {
    return <UserDetailPage user={selectedUser} data={data} onBack={onBackToUsers} />;
  }
  if (page === 'users') {
    return (
      <UsersPage
        data={data}
        campusId={campusId}
        onCampusChange={onCampusChange}
        onSelectUser={onSelectUser}
      />
    );
  }
  if (page === 'rentals') return <RentalsPage data={data} campusId={campusId} />;
  if (page === 'listings') return <ListingsPage data={data} campusId={campusId} />;
  if (page === 'posts') return <PostsPage data={data} campusId={campusId} />;
  if (page === 'reports') return <ReportsPage data={data} campusId={campusId} />;
  if (page === 'claims') return <ClaimsPage data={data} campusId={campusId} />;
  if (page === 'campuses') return <CampusesPage campuses={data.campuses} />;
  if (page === 'founding') return <FoundingClosetsPage data={data} campusId={campusId} />;
  return <ActivityLogPage data={data} />;
}
