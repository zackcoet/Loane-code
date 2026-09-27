/**
 * My Rentals — Renting and Lending.
 *
 * Two tabs because the same person is both: she lends her formal and
 * rents someone's boots the same weekend, and mixing those in one list
 * makes it impossible to see what needs her attention.
 *
 * Within each tab, anything that needs an answer sorts to the top.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import {
  BOOKING_STATUS_LABELS,
  TERMINAL_BOOKING_STATUSES,
  color,
  controls,
  formatRange,
  radius,
  spacing,
  type Booking,
} from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useMyBookings } from '../src/hooks/useBookings';

/** Does this booking need something from me right now? */
function needsMe(booking: Booking, isLender: boolean): boolean {
  if (booking.status === 'requested') return isLender;
  if (booking.status === 'confirmed') {
    return isLender ? !booking.handoff.dropoffAt : Boolean(booking.handoff.dropoffAt);
  }
  if (booking.status === 'with_renter') return true;
  if (booking.status === 'returned') return isLender;
  return false;
}

export default function MyRentals() {
  const router = useRouter();
  const [tab, setTab] = useState<'renting' | 'lending'>('renting');
  const { bookings, loading } = useMyBookings(tab);

  const isLender = tab === 'lending';

  const { active, past } = useMemo(() => {
    const live = bookings.filter((b) => !TERMINAL_BOOKING_STATUSES.includes(b.status));
    const done = bookings.filter((b) => TERMINAL_BOOKING_STATUSES.includes(b.status));
    // Anything waiting on me first.
    live.sort((a, b) => Number(needsMe(b, isLender)) - Number(needsMe(a, isLender)));
    return { active: live, past: done };
  }, [bookings, isLender]);

  const rows = [
    ...(active.length ? [{ header: 'Active' as const }] : []),
    ...active.map((b) => ({ booking: b })),
    ...(past.length ? [{ header: 'Past' as const }] : []),
    ...past.map((b) => ({ booking: b })),
  ];

  return (
    <Screen flush>
      <Header title="My Rentals" onBack={() => router.back()} />

      <View style={styles.tabRow}>
        {(
          [
            ['renting', 'Renting'],
            ['lending', 'Lending'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
          >
            <Text variant="label" tone={tab === value ? 'primary' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : bookings.length === 0 ? (
        <EmptyState
          title={tab === 'renting' ? 'No rentals yet' : 'Nothing lent out yet'}
          body={
            tab === 'renting'
              ? 'Pieces you request will show up here.'
              : 'When someone asks to rent from your closet, it lands here.'
          }
          actionLabel={tab === 'renting' ? 'Browse closets' : undefined}
          onAction={tab === 'renting' ? () => router.replace('/(tabs)/discover') : undefined}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, index) => ('header' in row ? `h-${row.header}` : row.booking.id) + index}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            'header' in item ? (
              <Text variant="label" tone="secondary" style={styles.sectionHeader}>
                {item.header}
              </Text>
            ) : (
              <Row
                booking={item.booking}
                isLender={isLender}
                onPress={() =>
                  router.push({ pathname: '/rental/[id]', params: { id: item.booking.id } })
                }
              />
            )
          }
        />
      )}
    </Screen>
  );
}

function Row({
  booking,
  isLender,
  onPress,
}: {
  booking: Booking;
  isLender: boolean;
  onPress: () => void;
}) {
  const them = isLender ? booking.renter : booking.lender;
  const wants = needsMe(booking, isLender);
  const over = TERMINAL_BOOKING_STATUSES.includes(booking.status);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${booking.listing.name}, ${BOOKING_STATUS_LABELS[booking.status]}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.thumb, over && styles.dimmed]}>
        {booking.listing.coverUrl ? (
          <Image
            source={{ uri: booking.listing.coverUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}
      </View>

      <View style={styles.rowText}>
        <Text numberOfLines={1} tone={over ? 'muted' : 'primary'}>
          {booking.listing.name}
        </Text>
        <Text variant="bodySmall" tone="secondary">
          {isLender ? 'to' : 'from'} @{them.username}
        </Text>
        {booking.startDate && booking.endDate ? (
          <Text variant="caption" tone="muted">
            {formatRange({ startDate: booking.startDate, endDate: booking.endDate })}
          </Text>
        ) : null}
      </View>

      <View style={[styles.badge, wants && styles.badgeAttention]}>
        <Text variant="caption" tone={wants ? 'inverse' : 'secondary'}>
          {wants ? 'Your turn' : BOOKING_STATUS_LABELS[booking.status]}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.inverse },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionHeader: { marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: controls.minTapTarget,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  rowPressed: { backgroundColor: color.surface.muted },
  thumb: {
    width: 56,
    height: 72,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  dimmed: { opacity: 0.45 },
  rowText: { flex: 1, marginLeft: spacing.md },
  badge: {
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginLeft: spacing.sm,
  },
  badgeAttention: {
    backgroundColor: color.surface.inverse,
    borderColor: color.border.inverse,
  },
});
