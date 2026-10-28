import { useState } from 'react';
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_LABELS,
  DISPUTE_OUTCOMES,
  bookingMatchesSearch,
  personLabelWithCopy,
  DISPUTE_OUTCOME_LABELS,
  type Booking,
  type DisputeOutcome,
} from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatMoney, matchesCampus, toDate } from '../data/adminData';
import { EmptyState, Panel, Pill, Toolbar } from '../components/ui';
import { PersonLink } from '../components/PersonLink';
import { ActionDialog } from '../components/ActionDialog';
import { adminErrorMessage, resolveDispute } from '../data/adminActions';

export function RentalsPage({
  data,
  campusId,
  onOpenUser,
}: {
  data: AdminData;
  campusId: string;
  /** Opens her page under Users. */
  onOpenUser: (uid: string) => void;
}) {
  const campusBookings = data.bookings
    .filter((booking) => matchesCampus(booking, campusId))
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));

  // A lender flagged a problem with a return within her 48-hour window.
  // These are the only bookings that need a human, so they go first
  // rather than being one indistinguishable row among hundreds. They are
  // never hidden by the search below — a dispute must not be missed
  // because someone left a filter on.
  const disputed = campusBookings.filter((booking) => booking.status === 'disputed');

  // Search and status, like Listings and Posts: finding one girl's
  // rental among 250 by scrolling was the only way before.
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const usersByUid = new Map(data.users.map((user) => [user.uid, user]));
  const bookings = campusBookings
    .filter((booking) => status === 'all' || booking.status === status)
    .filter((booking) => bookingMatchesSearch(booking, usersByUid, query));
  const filtering = query.trim() !== '' || status !== 'all';

  // Each girl by her name today (a rename or a deleted account shows
  // right), clickable to her page. The rental's own copy is only the
  // fallback when the dashboard doesn't have her account loaded.
  const people = (booking: Booking) => (
    <>
      <PersonLink
        prefix="Lender"
        person={personLabelWithCopy(booking.lenderUid, data.users, booking.lender)}
        onOpen={onOpenUser}
      />
      <PersonLink
        prefix={booking.kind === 'purchase' ? 'Buyer' : 'Renter'}
        person={personLabelWithCopy(booking.renterUid, data.users, booking.renter)}
        onOpen={onOpenUser}
      />
    </>
  );

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
                <th>Who</th>
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
                    {booking.kind === 'purchase' ? <Pill tone="neutral">Sale</Pill> : null}
                    <div className="cell-note">{booking.returnProblem?.note}</div>
                  </td>
                  <td>{booking.listing.name}</td>
                  <td>{people(booking)}</td>
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
                        {[
                          ...booking.handoff.returnPhotos,
                          ...(booking.returnProblem?.photos ?? []),
                        ].map((photo) => (
                          <img key={photo.path} src={photo.url} alt="Condition on return" />
                        ))}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => {
                          // Start each decision fresh — the last one's
                          // pick must not carry over to a different girl.
                          setOutcome('inconclusive');
                          setDeciding(booking);
                        }}
                      >
                        Decide
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      <Toolbar>
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search piece or name"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {BOOKING_STATUSES.map((item) => (
            <option key={item} value={item}>
              {BOOKING_STATUS_LABELS[item]}
            </option>
          ))}
        </select>
      </Toolbar>

      <Panel
        title="All Bookings"
        kicker={
          filtering
            ? `${bookings.length} of ${campusBookings.length} loaded`
            : `${bookings.length} loaded`
        }
      >
        {bookings.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Dates</th>
                <th>Listing</th>
                <th>Who</th>
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
                  <td>
                    {booking.startDate && booking.endDate
                      ? `${booking.startDate} to ${booking.endDate}`
                      : 'Purchase'}
                  </td>
                  <td>{booking.listing.name}</td>
                  <td>{people(booking)}</td>
                  <td>{formatMoney(booking.amounts.renterTotalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : filtering ? (
          <EmptyState
            title="No bookings match"
            body="Try another name, or set the status back to All statuses."
          />
        ) : (
          <EmptyState
            title="No bookings yet"
            body="Rental requests and sales on this campus will appear here."
          />
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
