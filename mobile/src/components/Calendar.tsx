/**
 * A month calendar for picking a rental start date.
 *
 * Built by hand rather than pulling in a date-picker dependency: we need
 * exactly one behaviour — grey out days a rental could not start on — and
 * every library wants to own more of the screen than that.
 *
 * A day is disabled when ANY day the rental would cover is unavailable.
 * So a free Friday still greys out if the 3-day rental would run into a
 * booked Sunday. What she sees is exactly what the server will accept.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  addDays,
  canStartOn,
  color,
  controls,
  radius,
  spacing,
  toIsoDate,
  type IsoDate,
} from '@loane/shared';
import { IconButton } from './IconButton';
import { Text } from './Text';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  /** Days that cannot be part of a rental. */
  unavailable: Set<IsoDate>;
  /** How long the rental runs, so we can check the whole span. */
  durationDays: number;
  selected: IsoDate | null;
  onSelect: (date: IsoDate) => void;
  /** How far ahead she may book. */
  horizonDays?: number;
}

export function Calendar({
  unavailable,
  durationDays,
  selected,
  onSelect,
  horizonDays = 180,
}: Props) {
  const today = toIsoDate(new Date());
  const [monthOffset, setMonthOffset] = useState(0);

  const { label, weeks, canGoBack, canGoForward } = useMemo(() => {
    const base = new Date(`${today}T00:00:00Z`);
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + monthOffset);

    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    // Pad to the start of the week so the columns line up.
    const cells: (IsoDate | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(toIsoDate(new Date(Date.UTC(year, month, day))));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (IsoDate | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    return {
      label: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      weeks: rows,
      canGoBack: monthOffset > 0,
      canGoForward: monthOffset < Math.ceil(horizonDays / 30),
    };
  }, [today, monthOffset, horizonDays]);

  const lastBookable = addDays(today, horizonDays);

  return (
    <View>
      <View style={styles.monthRow}>
        <IconButton
          glyph="‹"
          accessibilityLabel="Previous month"
          onPress={() => setMonthOffset((m) => Math.max(0, m - 1))}
          tint={canGoBack ? color.icon.default : color.text.disabled}
        />
        <Text variant="label">{label}</Text>
        <IconButton
          glyph="›"
          accessibilityLabel="Next month"
          onPress={() => setMonthOffset((m) => m + 1)}
          tint={canGoForward ? color.icon.default : color.text.disabled}
        />
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day, index) => (
          <View key={`${day}-${index}`} style={styles.cell}>
            <Text variant="caption" tone="muted">
              {day}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((date, dayIndex) => {
            if (!date) return <View key={`blank-${dayIndex}`} style={styles.cell} />;

            const past = date < today;
            const beyond = date > lastBookable;
            const free = canStartOn(date, durationDays, unavailable);
            const disabled = past || beyond || !free;
            const isSelected = date === selected;

            return (
              <Pressable
                key={date}
                disabled={disabled}
                onPress={() => onSelect(date)}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected: isSelected }}
                accessibilityLabel={date}
                style={[styles.cell, styles.day, isSelected && styles.daySelected]}
              >
                <Text
                  variant="bodySmall"
                  tone={isSelected ? 'inverse' : disabled ? 'disabled' : 'primary'}
                  style={disabled && !past ? styles.struck : undefined}
                >
                  {Number(date.slice(-2))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <Text variant="caption" tone="muted">
          Crossed-out days are already booked or blocked
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { borderRadius: radius.pill, minHeight: controls.minTapTarget / 1.2 },
  daySelected: { backgroundColor: color.surface.inverse },
  struck: { textDecorationLine: 'line-through' },
  legend: { marginTop: spacing.sm },
});
