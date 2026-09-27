import { useState } from 'react';
import {
  CATEGORY_LABELS,
  LISTING_STATUSES,
  OCCASION_LABELS,
  OCCASIONS,
  type Occasion,
} from '@loane/shared';
import type { AdminData } from '../data/adminData';
import { formatMoney, humanize, matchesCampus } from '../data/adminData';
import { ModerationGrid } from '../components/media';
import { Panel, Toolbar } from '../components/ui';
import { ActionDialog } from '../components/ActionDialog';
import { adminErrorMessage, hideListing, restoreListing } from '../data/adminActions';

export function ListingsPage({ data, campusId }: { data: AdminData; campusId: string }) {
  // Taking something down and putting it back both need a reason,
  // because both write an audit row.
  const [target, setTarget] = useState<{ id: string; hide: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (reason: string) => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await (target.hide ? hideListing : restoreListing)({ id: target.id, reason });
      setTarget(null);
    } catch (err) {
      setError(adminErrorMessage(err, 'Could not do that.'));
    } finally {
      setBusy(false);
    }
  };

  const [query, setQuery] = useState('');
  const [occasion, setOccasion] = useState('all');
  const [status, setStatus] = useState('all');

  const listings = data.listings
    .filter((listing) => matchesCampus(listing, campusId))
    .filter((listing) => status === 'all' || listing.status === status)
    .filter((listing) => occasion === 'all' || listing.occasions.includes(occasion as Occasion))
    .filter((listing) => {
      const text = `${listing.name} ${listing.brand ?? ''} ${listing.owner.displayName}`.toLowerCase();
      return text.includes(query.toLowerCase().trim());
    });

  return (
    <>
      <Toolbar>
        <input
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search listings"
        />
        <select value={occasion} onChange={(event) => setOccasion(event.target.value)}>
          <option value="all">All occasions</option>
          {OCCASIONS.map((item) => (
            <option key={item} value={item}>
              {OCCASION_LABELS[item]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {LISTING_STATUSES.map((item) => (
            <option key={item} value={item}>
              {humanize(item)}
            </option>
          ))}
        </select>
      </Toolbar>
      <Panel title="Listings" kicker={`${listings.length} loaded and filtered`}>
        <ModerationGrid
          onAction={(id, status) => setTarget({ id, hide: status !== 'suspended' })}
          emptyTitle="No listings match"
          items={listings.map((listing) => ({
            id: listing.id,
            imageUrl: listing.coverUrl,
            title: listing.name,
            subtitle: `${listing.owner.displayName} · ${CATEGORY_LABELS[listing.category]}`,
            status: listing.status,
            meta: `${formatMoney(listing.pricing.threeDayCents)} / 3 days · ${listing.stats.viewCount} views`,
            actionLabel: 'Hide listing',
          }))}
        />
      </Panel>

      <ActionDialog
        open={target !== null}
        title={target?.hide ? 'Take this listing down?' : 'Put this listing back up?'}
        description={
          target?.hide
            ? 'It comes out of the marketplace and she is told why. Nothing is deleted.'
            : 'It becomes visible on her campus again.'
        }
        confirmLabel={target?.hide ? 'Take it down' : 'Restore it'}
        danger={error ?? undefined}
        busy={busy}
        onConfirm={(reason) => void apply(reason)}
        onClose={() => {
          setTarget(null);
          setError(null);
        }}
      />
    </>
  );
}
