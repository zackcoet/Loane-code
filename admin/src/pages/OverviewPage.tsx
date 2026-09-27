import { useMemo } from 'react';
import type { Campus } from '@loane/shared';
import type { AdminData, DateRangeKey } from '../data/adminData';
import { getDateWindow } from '../data/adminData';
import { makeFunnel, makeOverviewMetrics, makeRetention, scopeData } from '../data/analytics';
import { ChartCard, Funnel } from '../components/charts';
import { CampusSelect, EmptyState, MetricCard, Panel, Segmented, Toolbar } from '../components/ui';

interface Props {
  data: AdminData;
  dateRange: DateRangeKey;
  campusId: string;
  onDateRangeChange: (value: DateRangeKey) => void;
  onCampusChange: (value: string) => void;
}

export function OverviewPage({ data, dateRange, campusId, onDateRangeChange, onCampusChange }: Props) {
  const window = useMemo(() => getDateWindow(dateRange), [dateRange]);
  const scoped = useMemo(() => scopeData(data, campusId), [data, campusId]);
  const metrics = useMemo(() => makeOverviewMetrics(scoped, window), [scoped, window]);
  const funnel = useMemo(() => makeFunnel(scoped, window), [scoped, window]);
  const retention = useMemo(() => makeRetention(scoped.users, scoped.events), [scoped]);

  return (
    <>
      <Toolbar>
        <Segmented
          value={dateRange}
          options={[
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['all', 'All time'],
          ]}
          onChange={(value) => onDateRangeChange(value as DateRangeKey)}
        />
        <CampusSelect campuses={data.campuses} value={campusId} onChange={onCampusChange} />
        <LoadedNotice campuses={scoped.campuses} />
      </Toolbar>

      <section className="metric-grid">
        {metrics.headlines.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="dashboard-grid">
        <ChartCard title="Signups Over Time" points={metrics.signupsChart} />
        <ChartCard title="Active Users Over Time" points={metrics.activeUsersChart} />
        <ChartCard title="Listings Over Time" points={metrics.listingsChart} />
        <ChartCard title="Posts Over Time" points={metrics.postsChart} />
      </section>

      <section className="two-column">
        <Panel title="Activation Funnel" kicker="Signed up to rental completed">
          <Funnel rows={funnel} />
        </Panel>
        <Panel title="Retention" kicker="Signup cohorts returning later">
          {retention.length > 0 ? (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Signup week</th>
                  <th>People</th>
                  <th>Next week</th>
                  <th>Later weeks</th>
                </tr>
              </thead>
              <tbody>
                {retention.map((row) => (
                  <tr key={row.week}>
                    <td>{row.week}</td>
                    <td>{row.signups}</td>
                    <td>{row.nextWeek}</td>
                    <td>{row.later}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              title="No retention data yet"
              body="After Phase 1 accounts return across multiple weeks, cohorts will appear here."
            />
          )}
        </Panel>
      </section>
    </>
  );
}

function LoadedNotice({ campuses }: { campuses: Campus[] }) {
  const label = campuses.length === 1 ? campuses[0]?.name : 'all campuses';
  return <span className="muted">Showing the latest limited emulator data for {label}.</span>;
}
