import type { AdminData } from '../data/adminData';
import { formatMoney, formatShortDate, humanize, matchesCampus } from '../data/adminData';
import { EmptyState, Panel } from '../components/ui';

export function ClaimsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  const claims = data.damageClaims.filter((claim) => matchesCampus(claim, campusId));
  return (
    <Panel title="Damage Claims" kicker={`${claims.length} loaded claims`}>
      {claims.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Type</th>
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
                <td>{formatMoney(claim.requestedCents)}</td>
                <td>{claim.description}</td>
                <td>{formatShortDate(claim.claimWindowEndsAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No damage claims" body="Phase 5 protection and returns will send claim reviews here." />
      )}
    </Panel>
  );
}
