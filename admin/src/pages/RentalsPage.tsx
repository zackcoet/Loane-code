import { BOOKING_STATUS_LABELS } from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatMoney, matchesCampus, toDate } from '../data/adminData';
import { EmptyState, Panel, Pill } from '../components/ui';

export function RentalsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const bookings = data.bookings
    .filter((booking) => matchesCampus(booking, campusId))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));

  // A lender flagged a problem with a return within her 48-hour window.
  // These are the only bookings that need a human, so they go first
  // rather than being one indistinguishable row among hundreds.
  const disputed = bookings.filter((booking) => booking.status === 'disputed');

  return (
    <>
      {disputed.length > 0 ? (
        <Panel title="Needs review" kicker={`${disputed.length} flagged`}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Problem</th>
                <th>Listing</th>
                <th>Lender</th>
                <th>Renter</th>
                <th>Garment value</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {disputed.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <Pill tone="bad">{booking.returnProblem?.type ?? 'flagged'}</Pill>
                    <div className="cell-note">{booking.returnProblem?.note}</div>
                  </td>
                  <td>{booking.listing.name}</td>
                  <td>{booking.lender.displayName}</td>
                  <td>{booking.renter.displayName}</td>
                  <td>{formatMoney(booking.amounts.protectionHoldCents)}</td>
                  <td>
                    {(booking.returnProblem?.photos.length ?? 0) +
                      booking.handoff.dropoffPhotos.length +
                      booking.handoff.returnPhotos.length}{' '}
                    photos
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

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
                  <Pill
                    tone={
                      booking.status === 'completed'
                        ? 'good'
                        : booking.status === 'disputed'
                          ? 'bad'
                          : 'neutral'
                    }
                  >
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
    </>
  );
}
