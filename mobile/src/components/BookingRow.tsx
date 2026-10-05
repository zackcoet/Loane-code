/**
 * One rental, as a row.
 *
 * Shared by Activity, My Rentals and Rental Requests so the same
 * booking never looks like two different things in two places. It was
 * copied into My Rentals first; Activity needed the same thing, and a
 * second copy is how the two drift.
 *
 * The badge is the point of the row. "Your turn" when the next move is
 * hers, the plain status when it is not — so a list can be scanned for
 * what needs doing without reading a single line of it.
 */

import { Image, Pressable, StyleSheet, View } from 'react-native';
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
import { Text } from './Text';

/**
 * Does this booking need something from me right now?
 *
 * The one definition, so Activity and My Rentals cannot disagree about
 * whose turn it is.
 */
export function needsMe(booking: Booking, isLender: boolean): boolean {
  if (booking.status === 'requested') return isLender;
  if (booking.status === 'confirmed') {
    return isLender ? !booking.handoff.dropoffAt : Boolean(booking.handoff.dropoffAt);
  }
  if (booking.status === 'with_renter') return true;
  if (booking.status === 'returned') return isLender;
  // Completed: both sides are asked for a review, which is a nudge
  // rather than something blocking the rental.
  return false;
}

interface Props {
  booking: Booking;
  /** Am I the lender on this one? Changes "to"/"from" and whose turn it is. */
  isLender: boolean;
  onPress: () => void;
}

export function BookingRow({ booking, isLender, onPress }: Props) {
  const them = isLender ? booking.renter : booking.lender;
  const wants = needsMe(booking, isLender);
  const over = TERMINAL_BOOKING_STATUSES.includes(booking.status);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${booking.listing.name}, ${
        wants ? 'needs you' : BOOKING_STATUS_LABELS[booking.status]
      }`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.thumb, over && styles.dimmed]}>
        {booking.listing.coverUrl ? (
          <Image source={{ uri: booking.listing.coverUrl }} style={styles.image} resizeMode="cover" />
        ) : null}
      </View>

      <View style={styles.text}>
        <Text numberOfLines={1} tone={over ? 'muted' : 'primary'}>
          {booking.listing.name}
        </Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {isLender ? 'to' : 'from'} @{them.username}
        </Text>
        {booking.startDate && booking.endDate ? (
          <Text variant="caption" tone="muted">
            {formatRange({ startDate: booking.startDate, endDate: booking.endDate })}
          </Text>
        ) : null}
      </View>

      <View style={[styles.badge, wants && styles.badgeAttention]}>
        <Text variant="caption" tone={wants ? 'primary' : 'secondary'}>
          {wants ? 'Your turn' : BOOKING_STATUS_LABELS[booking.status]}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: controls.minTapTarget,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  pressed: { opacity: 0.6 },
  thumb: {
    width: 52,
    height: 64,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.surface.muted,
  },
  dimmed: { opacity: 0.5 },
  image: { width: '100%', height: '100%' },
  text: { flex: 1, gap: 1 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border.default,
  },
  badgeAttention: {
    backgroundColor: color.accent.background,
    borderColor: color.accent.border,
  },
});
