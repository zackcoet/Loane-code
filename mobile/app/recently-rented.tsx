/**
 * Pieces she has actually rented, most recent first.
 *
 * Separate from My Rentals, which is about what needs her attention.
 * This is a history: the thing she reaches for when she wants that
 * dress again, or the person she rented from last time.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, formatRange, spacing } from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useMyBookings } from '../src/hooks/useBookings';

export default function RecentlyRented() {
  const router = useRouter();
  const { bookings, loading } = useMyBookings('renting');

  // Only rentals that actually happened — a declined request is not
  // something she rented.
  const rented = useMemo(
    () => bookings.filter((b) => ['with_renter', 'returned', 'completed'].includes(b.status)),
    [bookings],
  );

  return (
    <Screen flush>
      <Header title="Recently Rented" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : rented.length === 0 ? (
        <EmptyState
          title="Nothing rented yet"
          body="Pieces you have borrowed show up here so you can find them again."
          actionLabel="Browse closets"
          onAction={() => router.replace('/(tabs)/discover')}
        />
      ) : (
        <View style={styles.list}>
          {rented.map((booking) => (
            <Pressable
              key={booking.id}
              accessibilityRole="button"
              accessibilityLabel={booking.listing.name}
              onPress={() =>
                router.push({ pathname: '/listing/[id]', params: { id: booking.listingId } })
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              {booking.listing.coverUrl ? (
                <Image
                  source={{ uri: booking.listing.coverUrl }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={styles.text}>
                <Text numberOfLines={1}>{booking.listing.name}</Text>
                <Text variant="bodySmall" tone="secondary">
                  from @{booking.lender.username}
                </Text>
                {booking.startDate && booking.endDate ? (
                  <Text variant="caption" tone="muted">
                    {formatRange({ startDate: booking.startDate, endDate: booking.endDate })}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: controls.minTapTarget,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  pressed: { backgroundColor: color.surface.muted },
  thumb: {
    width: 56,
    height: 72,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
  },
  text: { flex: 1, marginLeft: spacing.md },
});
