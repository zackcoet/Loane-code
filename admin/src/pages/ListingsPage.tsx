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

export function ListingsPage({ data, campusId }: { data: AdminData; campusId: string }) {
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
    </>
  );
}
