import type { AppEvent, Listing, Post, ReportPersonLabel } from '@loane/shared';
import { formatShortDate, humanize } from '../data/adminData';
import { EmptyState, ImageBlock, Pill } from './ui';
import { PersonLink } from './PersonLink';

export function Timeline({ events }: { events: AppEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        body="This user's app events will appear here once tracking data exists."
      />
    );
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
  if (items.length === 0)
    return <EmptyState title="Nothing here yet" body="Seeded or real content will appear here." />;
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
  onOpenPerson,
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
    /** Whose it is, by her account today (moderationButtonBlockedReason's sibling). */
    person?: ReportPersonLabel;
    /** Why the button is greyed out, or null when it can be pressed. */
    blockedReason?: string | null;
  }>;
  /** Opens the hide / restore dialog for one item. */
  onAction?: (id: string, status: Listing['status'] | Post['status']) => void;
  /** Opens her page under Users. */
  onOpenPerson?: (uid: string) => void;
}) {
  if (items.length === 0)
    return (
      <EmptyState title={emptyTitle} body="Try clearing filters or running the seed script." />
    );
  return (
    <div className="moderation-list">
      {items.map((item) => (
        <article key={item.id}>
          <ImageBlock imageUrl={item.imageUrl} alt={item.title} />
          <div>
            <p className="label">{item.subtitle}</p>
            <h3>{item.title}</h3>
            <p className="muted">{item.meta}</p>
            {item.person && onOpenPerson ? (
              <PersonLink prefix="By" person={item.person} onOpen={onOpenPerson} />
            ) : null}
            {item.blockedReason ? <p className="cell-note">{item.blockedReason}</p> : null}
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
            // Something its owner removed can't be taken down, and a
            // deleted girl's things can't be put back (the server refuses
            // both). Say why rather than fail after a reason is typed.
            disabled={!onAction || item.status === 'removed' || Boolean(item.blockedReason)}
            title={
              item.blockedReason ??
              (item.status === 'removed' ? 'Its owner already removed it.' : undefined)
            }
          >
            {item.actionLabel}
          </button>
        </article>
      ))}
    </div>
  );
}
