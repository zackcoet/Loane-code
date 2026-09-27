import type { AppEvent, Listing, Post } from '@loane/shared';
import { formatShortDate, humanize } from '../data/adminData';
import { EmptyState, ImageBlock, Pill } from './ui';

export function Timeline({ events }: { events: AppEvent[] }) {
  if (events.length === 0) {
    return <EmptyState title="No activity yet" body="This user's app events will appear here once tracking data exists." />;
  }
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id}>
          <span>{formatShortDate(event.createdAt)}</span>
          <strong>{humanize(event.type)}</strong>
          <p>
            {event.surface} · {event.targetType ?? 'screen'}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ThumbGrid({
  items,
}: {
  items: Array<{ id: string; imageUrl: string | null; title: string; subtitle: string }>;
}) {
  if (items.length === 0) return <EmptyState title="Nothing here yet" body="Seeded or real content will appear here." />;
  return (
    <div className="thumb-grid">
      {items.map((item) => (
        <article key={item.id}>
          <ImageBlock imageUrl={item.imageUrl} alt={item.title} />
          <strong>{item.title}</strong>
          <span>{item.subtitle}</span>
        </article>
      ))}
    </div>
  );
}

export function ModerationGrid({
  items,
  emptyTitle,
  onAction,
}: {
  emptyTitle: string;
  items: Array<{
    id: string;
    imageUrl: string | null;
    title: string;
    subtitle: string;
    status: Listing['status'] | Post['status'];
    meta: string;
    actionLabel: string;
  }>;
  /** Opens the hide / restore dialog for one item. */
  onAction?: (id: string, status: Listing['status'] | Post['status']) => void;
}) {
  if (items.length === 0) return <EmptyState title={emptyTitle} body="Try clearing filters or running the seed script." />;
  return (
    <div className="moderation-list">
      {items.map((item) => (
        <article key={item.id}>
          <ImageBlock imageUrl={item.imageUrl} alt={item.title} />
          <div>
            <p className="label">{item.subtitle}</p>
            <h3>{item.title}</h3>
            <p className="muted">{item.meta}</p>
          </div>
          <Pill
            tone={
              item.status === 'active' ? 'good' : item.status === 'suspended' ? 'bad' : 'neutral'
            }
          >
            {item.status}
          </Pill>
          <button
            className="outline-button"
            onClick={() => onAction?.(item.id, item.status)}
            disabled={!onAction}
          >
            {item.actionLabel}
          </button>
        </article>
      ))}
    </div>
  );
}
