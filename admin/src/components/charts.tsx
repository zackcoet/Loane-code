import { EmptyState, Panel } from './ui';

export function ChartCard({ title, points }: { title: string; points: Array<{ label: string; value: number }> }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <Panel title={title}>
      {points.length > 0 ? (
        <div className="bar-chart">
          {points.map((point) => (
            <div key={`${title}-${point.label}`} className="bar-column">
              <span>{point.value}</span>
              <div style={{ height: `${Math.max(8, (point.value / max) * 120)}px` }} />
              <small>{point.label}</small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No data yet" body="This chart will fill as events arrive in Phase 3." />
      )}
    </Panel>
  );
}

export function Funnel({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(rows[0]?.value ?? 0, 1);
  return (
    <div className="funnel">
      {rows.map((row) => (
        <div key={row.label} className="funnel-row">
          <span>{row.label}</span>
          <div>
            <div style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
          </div>
          <strong>{row.value.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}
