/**
 * "When it's free" - the whole calendar for one listing.
 *
 * READ ONLY. Picking dates still happens on the request screen, where
 * the price moves with the length of the rental. This answers the
 * question she has before she commits to any of that: is it free the
 * weekend I need it?
 *
 * A ROUTE, NOT A MODAL, on purpose. The filter sheet is the app's only
 * full-screen Modal and it has cost two rounds of the same bug: a
 * Modal is a separate native view hierarchy with no safe-area provider
 * in it, so the header can sit under the Dynamic Island and the back
 * arrow goes off the top of the glass. Every ordinary screen goes
 * through Screen and has never had the problem.
 *
 * The dates come from the listing itself, which the server keeps
 * current: `bookedDates` is written by the booking functions and
 * `blackoutDates` by the lender. Nothing is computed here, so this
 * cannot drift from what the request screen will accept.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { color, radius, spacing } from '@loane/shared';
import { Calendar } from '../src/components/Calendar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { LoaneLoader } from '../src/components/LoaneLoader';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useListing } from '../src/hooks/useListing';
import { useUnavailableDates } from '../src/hooks/useBookings';

export default function Availability() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listing, loading } = useListing(id);
  const unavailable = useUnavailableDates(listing);

  if (loading) {
    return (
      <Screen flush>
        <Header title="When it's free" onBack={() => router.back()} />
        <View style={styles.centre}>
          <LoaneLoader size={34} />
        </View>
      </Screen>
    );
  }

  if (!listing) {
    return (
      <Screen flush>
        <Header title="When it's free" onBack={() => router.back()} />
        <EmptyState title="Not found" body="That item is no longer listed." />
      </Screen>
    );
  }

  return (
    <Screen flush scroll>
      <Header title="When it's free" onBack={() => router.back()} />

      <View style={styles.body}>
        <Text variant="label" tone="muted">
          {listing.name}
        </Text>

        <Calendar
          unavailable={unavailable}
          /*
            One day, which is what makes this read as availability
            rather than as a booking.

            The calendar greys a day out when a rental of
            `durationDays` could not START there, so a longer value
            would grey out days that are perfectly free simply because
            the day after them is taken. With 1, a day is grey if and
            only if it is actually taken.
          */
          durationDays={1}
          selected={null}
          // Nothing to select. Dates are chosen on the request screen.
          onSelect={() => {}}
        />

        <View style={styles.key}>
          <View style={[styles.swatch, styles.free]} />
          <Text variant="caption" tone="muted" uppercase={false}>
            Free
          </Text>
          <View style={[styles.swatch, styles.taken]} />
          <Text variant="caption" tone="muted" uppercase={false}>
            Already booked, or blocked by the lender
          </Text>
        </View>

        <Text variant="caption" tone="muted" uppercase={false}>
          Pick your dates when you send a request. The price depends on how long you keep it.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.md, gap: spacing.md },
  key: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  swatch: { width: 14, height: 14, borderRadius: radius.sm },
  free: { backgroundColor: color.surface.muted },
  taken: { backgroundColor: color.surface.disabled },
});
