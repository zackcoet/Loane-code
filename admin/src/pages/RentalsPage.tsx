import { useState } from 'react';
import {
  BOOKING_STATUS_LABELS,
  DISPUTE_OUTCOMES,
  DISPUTE_OUTCOME_LABELS,
  type Booking,
  type DisputeOutcome,
} from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatMoney, matchesCampus, toDate } from '../data/adminData';
import { EmptyState, Panel, Pill } from '../components/ui';
import { ActionDialog } from '../components/ActionDialog';
import { adminErrorMessage, resolveDispute } from '../data/adminActions';

export function RentalsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const bookings = data.bookings
    .filter((booking) => matchesCampus(booking, campusId))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));

  // A lender flagged a problem with a return within her 48-hour window.
  // These are the only bookings that need a human, so they go first
  // rather than being one indistinguishable row among hundreds.
  const disputed = bookings.filter((booking) => booking.status === 'disputed');

  const [deciding, setDeciding] = useState<Booking | null>(null);
  const [outcome, setOutcome] = useState<DisputeOutcome>('inconclusive');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (notes: string) => {
    if (!deciding) return;
    setBusy(true);
    setError(null);
    try {
      await resolveDispute({ bookingId: deciding.id, outcome, notes });
      setDeciding(null);
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not save that decision.'));
    } finally {
      setBusy(false);
    }
  };

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
                <th>Decide</th>
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
                  <td>{formatMoney(booking.amounts.liabilityCapCents)}</td>
                  <td>
                    {/* Before and after, side by side — the only
                        evidence there is, since no money is held. */}
                    <div className="photo-compare">
                      <div>
                        <h4>At drop-off</h4>
                        {booking.handoff.dropoffPhotos.map((photo) => (
                          <img key={photo.path} src={photo.url} alt="Condition at drop-off" />
                        ))}
                      </div>
                      <div>
                        <h4>On return</h4>
                        {[...booking.handoff.returnPhotos, ...(booking.returnProblem?.photos ?? [])].map(
                          (photo) => (
                            <img key={photo.path} src={photo.url} alt="Condition on return" />
                          ),
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button onClick={() => setDeciding(booking)}>Decide</button>
                    </div>
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

      <ActionDialog
        open={deciding !== null}
        title="Decide this dispute"
        description="Both sides are told what you decided. No money moves — payments are not live yet."
        confirmLabel="Record decision"
        danger={error ?? undefined}
        busy={busy}
        onConfirm={(notes) => void decide(notes)}
        onClose={() => {
          setDeciding(null);
          setError(null);
        }}
      >
        <div className="dialog-choices">
          {DISPUTE_OUTCOMES.map((value) => (
            <button
              key={value}
              className={`choice ${outcome === value ? 'on' : ''}`}
              onClick={() => setOutcome(value)}
            >
              {DISPUTE_OUTCOME_LABELS[value]}
            </button>
          ))}
        </div>
      </ActionDialog>
    </>
  );
}
