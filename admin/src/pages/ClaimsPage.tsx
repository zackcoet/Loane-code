import { reportPersonLabel } from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatMoney, formatShortDate, humanize, matchesCampus } from '../data/adminData';
import { EmptyState, Panel } from '../components/ui';
import { PersonLink } from '../components/PersonLink';

export function ClaimsPage({
  data,
  campusId,
  onOpenUser,
}: {
  data: AdminData;
  campusId: string;
  /** Opens her page under Users. */
  onOpenUser: (uid: string) => void;
}) {
  const claims = data.damageClaims.filter((claim) => matchesCampus(claim, campusId));
  return (
    <Panel title="Damage Claims" kicker={`${claims.length} loaded claims`}>
      {claims.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Type</th>
              <th>Who</th>
              <th>Requested</th>
              <th>Description</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id}>
                <td>{humanize(claim.status)}</td>
                <td>{humanize(claim.type)}</td>
                <td>
                  {/* A claim stores only account ids; names are looked up live. */}
                  <PersonLink
                    prefix="Lender"
                    person={reportPersonLabel(claim.lenderUid, data.users)}
                    onOpen={onOpenUser}
                  />
                  <PersonLink
                    prefix="Renter"
                    person={reportPersonLabel(claim.renterUid, data.users)}
                    onOpen={onOpenUser}
                  />
                </td>
                <td>{formatMoney(claim.requestedCents)}</td>
                <td>{claim.description}</td>
                <td>{formatShortDate(claim.claimWindowEndsAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          title="No damage claims"
          body="Phase 5 protection and returns will send claim reviews here."
        />
      )}
    </Panel>
  );
}
