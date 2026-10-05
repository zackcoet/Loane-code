/**
 * Rental Requests.
 *
 * The one screen that answers "is anybody waiting on me?".
 *
 * My Rentals shows everything, in every status, for the whole history —
 * which is the right screen for "where is my dress" and the wrong one
 * for "somebody asked to rent my jacket an hour ago". This is only the
 * requests: the ones on my pieces that need a yes or no, and mine that
 * are still waiting on somebody else.
 *
 * Incoming comes first, because those are the ones where the delay is
 * mine. Accepting and declining happen on the rental itself, which is
 * where the dates, the photos and the money are.
 */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import {
  BOOKING_STATUS_LABELS,
  color,
  formatCentsShort,
  formatRange,
  radius,
  spacing,
  timeAgo,
  type Booking,
} from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useMyBookings } from '../src/hooks/useBookings';

export default function RentalRequests() {
  const router = useRouter();
  const lending = useMyBookings('lending');
  const renting = useMyBookings('renting');

  // Only what is genuinely still a request. Once it is accepted it is a
  // rental and belongs in My Rentals.
  const incoming = useMemo(
    () => lending.bookings.filter((b) => b.status === 'requested'),
    [lending.bookings],
  );
  const outgoing = useMemo(
    () => renting.bookings.filter((b) => b.status === 'requested'),
    [renting.bookings],
  );

  const loading = lending.loading || renting.loading;

  const rows: Array<{ kind: 'header'; title: string; note: string } | { kind: 'booking'; booking: Booking; incoming: boolean }> =
    [];
  rows.push({
    kind: 'header',
    title: 'Waiting on you',
    note:
      incoming.length === 0
        ? 'Nobody has asked to rent one of your pieces right now.'
        : `${incoming.length} ${incoming.length === 1 ? 'person wants' : 'people want'} to rent from you`,
  });
  incoming.forEach((booking) => rows.push({ kind: 'booking', booking, incoming: true }));
  rows.push({
    kind: 'header',
    title: 'You asked',
    note:
      outgoing.length === 0
        ? 'Requests you send show up here until she answers.'
        : `${outgoing.length} still waiting for an answer`,
  });
  outgoing.forEach((booking) => rows.push({ kind: 'booking', booking, incoming: false }));

  return (
    <Screen flush>
      <Header title="Rental Requests" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : incoming.length === 0 && outgoing.length === 0 ? (
        <EmptyState
          title="No requests right now"
          body="Requests on your pieces, and the ones you have sent, both land here."
          actionLabel="See all your rentals"
          onAction={() => router.push('/my-rentals')}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, index) =>
            row.kind === 'header' ? `h-${index}` : row.booking.id
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View style={styles.section}>
                <Text variant="label" tone="muted">
                  {item.title}
                </Text>
                <Text variant="caption" tone="muted" uppercase={false} style={styles.note}>
                  {item.note}
                </Text>
              </View>
            ) : (
              <RequestRow
                booking={item.booking}
                incoming={item.incoming}
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

function RequestRow({
  booking,
  incoming,
  onPress,
}: {
  booking: Booking;
  incoming: boolean;
  onPress: () => void;
}) {
  const other = incoming ? booking.renter : booking.lender;
  const dates =
    booking.startDate && booking.endDate
      ? formatRange({ startDate: booking.startDate, endDate: booking.endDate })
      : 'Purchase';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        incoming
          ? `${other.displayName} wants to rent ${booking.listing.name}`
          : `Your request for ${booking.listing.name}`
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {booking.listing.coverUrl ? (
        <Image source={{ uri: booking.listing.coverUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.photo} />
      )}

      <View style={styles.rowText}>
        <Text variant="bodySmall" style={styles.strong} numberOfLines={1}>
          {booking.listing.name}
        </Text>
        <Text variant="caption" tone="muted" uppercase={false} numberOfLines={1}>
          {incoming ? `${other.displayName} asked` : `You asked ${other.displayName}`} ·{' '}
          {timeAgo(booking.createdAt)}
        </Text>
        <Text variant="caption" tone="muted" uppercase={false} numberOfLines={1}>
          {dates}
        </Text>
        <Text variant="bodySmall" style={styles.strong}>
          {formatCentsShort(
            incoming ? booking.amounts.lenderPayoutCents : booking.amounts.renterTotalCents,
          )}
          <Text variant="caption" tone="muted" uppercase={false}>
            {incoming ? ' to you' : ' total'}
          </Text>
        </Text>
      </View>

      <View style={[styles.pill, incoming && styles.pillUrgent]}>
        <Text variant="caption" tone={incoming ? 'primary' : 'muted'} uppercase={false}>
          {incoming ? 'Answer' : BOOKING_STATUS_LABELS[booking.status]}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  section: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  note: { marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  pressed: { opacity: 0.6 },
  photo: {
    width: 56,
    height: 70,
    borderRadius: radius.sm,
    backgroundColor: color.surface.muted,
  },
  rowText: { flex: 1, gap: 1 },
  strong: { fontWeight: '600' },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border.default,
  },
  pillUrgent: { backgroundColor: color.accent.background, borderColor: color.accent.border },
});
