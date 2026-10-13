/**
 * Closet Calendar — what is out of her closet, and when.
 *
 * From Ella's mockup. Two views of the same month:
 *
 *   MONTH  a grid, each day shaded by how many pieces are out. Tap a
 *          day for what is out, what to hand over and what is coming
 *          back.
 *   WEEK   a row per piece, merlot where it is booked and grey where
 *          it is free — the view that answers "is the green dress
 *          free next weekend" at a glance.
 *
 * SHADING IS RELATIVE TO HER OWN CLOSET, not to an absolute number.
 * Four pieces out is a busy week for somebody with five and a quiet
 * one for somebody with thirty, and a scale that says otherwise is
 * telling her something untrue about her own month.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  addDays,
  color,
  controls,
  formatShortDate,
  radius,
  spacing,
  toIsoDate,
  type IsoDate,
} from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { LoaneLoader } from '../src/components/LoaneLoader';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useClosetCalendar } from '../src/hooks/useClosetCalendar';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** The week view shows a fortnight: this week and the next. */
const WEEK_DAYS = 14;

export default function ClosetCalendar() {
  const router = useRouter();
  const cal = useClosetCalendar();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<IsoDate | null>(null);

  const month = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const days: (IsoDate | null)[] = [];
    // Blanks so the 1st lands under the right weekday.
    for (let i = 0; i < first.getDay(); i += 1) days.push(null);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= last; d += 1) {
      days.push(toIsoDate(new Date(first.getFullYear(), first.getMonth(), d)));
    }
    return {
      days,
      label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  }, [monthOffset]);

  const fortnight = useMemo(
    () => Array.from({ length: WEEK_DAYS }, (_, i) => addDays(cal.today, i)),
    [cal.today],
  );

  if (cal.loading) {
    return (
      <Screen flush>
        <Header title="Closet Calendar" onBack={() => router.back()} />
        <View style={styles.centre}>
          <LoaneLoader size={34} />
        </View>
      </Screen>
    );
  }

  if (cal.runs.length === 0) {
    return (
      <Screen flush>
        <Header title="Closet Calendar" onBack={() => router.back()} />
        <EmptyState
          title="Nothing out yet"
          body="When somebody rents a piece, the dates show up here so you know what is where."
        />
      </Screen>
    );
  }

  const day = selected ? cal.byDate.get(selected) : null;

  return (
    <Screen flush>
      <Header title="Closet Calendar" onBack={() => router.back()} />

      <View style={styles.tabs}>
        {(['month', 'week'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
            style={[styles.tab, view === v && styles.tabOn]}
          >
            <Text variant="caption" tone={view === v ? 'inverse' : 'heading'}>
              {v === 'month' ? 'Month' : 'Week'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {view === 'month' ? (
          <>
            <View style={styles.monthBar}>
              <Pressable
                onPress={() => setMonthOffset((m) => m - 1)}
                hitSlop={12}
                accessibilityLabel="Previous month"
                accessibilityRole="button"
              >
                <Text variant="bodySmall" tone="heading">
                  ‹
                </Text>
              </Pressable>
              <Text variant="label" tone="heading">
                {month.label}
              </Text>
              <Pressable
                onPress={() => setMonthOffset((m) => m + 1)}
                hitSlop={12}
                accessibilityLabel="Next month"
                accessibilityRole="button"
              >
                <Text variant="bodySmall" tone="heading">
                  ›
                </Text>
              </Pressable>
            </View>

            <View style={styles.weekdays}>
              {WEEKDAYS.map((w, i) => (
                <Text key={i} variant="caption" tone="muted" style={styles.weekday}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {month.days.map((date, i) => {
                if (!date) return <View key={`b${i}`} style={styles.cell} />;
                const activity = cal.byDate.get(date);
                const outCount = activity?.out.length ?? 0;
                return (
                  <Pressable
                    key={date}
                    onPress={() => setSelected(date === selected ? null : date)}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatShortDate(date)}, ${outCount} out`}
                    style={[
                      styles.cell,
                      outCount > 0 && {
                        // Relative to her busiest day, not an absolute
                        // scale — see the note at the top.
                        backgroundColor: color.role.shared.background,
                        opacity: 0.25 + 0.75 * (outCount / cal.busiest),
                      },
                      date === cal.today && styles.todayCell,
                      date === selected && styles.selectedCell,
                    ]}
                  >
                    <Text variant="caption" tone={outCount > 0 ? 'inverse' : 'primary'}>
                      {Number(date.slice(-2))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {day ? (
              <View style={styles.daySheet}>
                <Text variant="label" tone="heading">
                  {formatShortDate(day.date)}
                </Text>
                <DayList label="Hand over today" items={day.dropoffs} />
                <DayList label="Coming back" items={day.returns} />
                <DayList label="Out" items={day.out} />
                {day.out.length === 0 && day.dropoffs.length === 0 && day.returns.length === 0 ? (
                  <Text variant="bodySmall" tone="muted" uppercase={false}>
                    Nothing out on this day.
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text variant="caption" tone="muted" uppercase={false} style={styles.hint}>
                Tap a day to see what is out.
              </Text>
            )}
          </>
        ) : (
          <View style={styles.weekView}>
            <View style={styles.weekHeader}>
              <View style={styles.pieceLabel} />
              {fortnight.map((d) => (
                <Text key={d} variant="caption" tone="muted" style={styles.weekDayLabel}>
                  {Number(d.slice(-2))}
                </Text>
              ))}
            </View>

            {cal.runs.map((run) => (
              <View key={run.listingId} style={styles.weekRow}>
                {/* Tapping the piece opens its blocked dates — the
                    weekend she wants it herself. This is the screen
                    where she notices she needs to. */}
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/blocked-dates', params: { id: run.listingId } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Block dates on ${run.name}`}
                  style={styles.pieceLabel}
                >
                  <Text variant="caption" numberOfLines={2} uppercase={false}>
                    {run.name}
                  </Text>
                </Pressable>
                {fortnight.map((d) => (
                  <View
                    key={d}
                    style={[styles.weekCell, run.busy.has(d) ? styles.busy : styles.free]}
                  />
                ))}
              </View>
            ))}

            <View style={styles.key}>
              <View style={[styles.keySwatch, styles.busy]} />
              <Text variant="caption" tone="muted" uppercase={false}>
                Out
              </Text>
              <View style={[styles.keySwatch, styles.free]} />
              <Text variant="caption" tone="muted" uppercase={false}>
                Free
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function DayList({ label, items }: { label: string; items: { id: string; listing: { name: string }; renter: { displayName: string } }[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.dayList}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      {items.map((b) => (
        <Text key={b.id} variant="bodySmall" uppercase={false}>
          {b.listing.name} · {b.renter.displayName}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  tabs: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surface.section,
    minHeight: 32,
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: color.role.shared.background },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  todayCell: { borderWidth: 1, borderColor: color.role.renter.background },
  selectedCell: { borderWidth: 2, borderColor: color.text.primary },
  daySheet: {
    marginTop: spacing.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: color.surface.section,
  },
  dayList: { gap: 2 },
  hint: { marginTop: spacing.lg, textAlign: 'center' },
  weekView: { gap: spacing.xs },
  weekHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  weekDayLabel: { flex: 1, textAlign: 'center' },
  weekRow: { flexDirection: 'row', alignItems: 'center', minHeight: controls.minTapTarget - 12 },
  pieceLabel: { width: 96, paddingRight: spacing.sm },
  weekCell: { flex: 1, height: 18, marginHorizontal: 1, borderRadius: 3 },
  busy: { backgroundColor: color.role.shared.background },
  free: { backgroundColor: color.surface.muted },
  key: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
  keySwatch: { width: 14, height: 14, borderRadius: 3 },
});
