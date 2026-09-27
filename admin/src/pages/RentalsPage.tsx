import { BOOKING_STATUS_LABELS } from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatMoney, matchesCampus, toDate } from '../data/adminData';
import { EmptyState, Panel, Pill } from '../components/ui';

export function RentalsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const bookings = data.bookings
    .filter((booking) => matchesCampus(booking, campusId))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));

  return (
    <Panel title="All Bookings" kicker={`${bookings.length} loaded`}>
      {bookings.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Dates</th>
              <th>Listing</th>
              <th>Lender</th>
              <th>Renter</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <Pill tone={booking.status === 'completed' ? 'good' : 'neutral'}>
                    {BOOKING_STATUS_LABELS[booking.status]}
                  </Pill>
                </td>
                <td>{booking.startDate && booking.endDate ? `${booking.startDate} to ${booking.endDate}` : 'Purchase'}</td>
                <td>{booking.listing.name}</td>
                <td>{booking.lender.displayName}</td>
                <td>{booking.renter.displayName}</td>
                <td>{formatMoney(booking.amounts.renterTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No bookings yet" body="Rental requests will appear here when Phase 4 rental data exists." />
      )}
    </Panel>
  );
}
