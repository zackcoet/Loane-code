/**
 * Request to rent.
 *
 * Pick 3 or 7 days, pick a start date, see what it costs, send the
 * request. The lender then has 48 hours to answer.
 *
 * ON PAYMENT: nothing is charged. During beta the two of them settle up
 * between themselves, and the screen says so plainly rather than
 * implying Loane is holding money it is not.
 */

import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  RENTAL_DURATIONS,
  REQUEST_EXPIRY_HOURS,
  addDays,
  calculateFees,
  color,
  formatCents,
  formatRange,
  spacing,
  type IsoDate,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Calendar } from '../src/components/Calendar';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Input } from '../src/components/Input';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useListing } from '../src/hooks/useListing';
import { useUnavailableDates } from '../src/hooks/useBookings';
import { requestBooking } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { logEvent } from '../src/analytics/events';

export default function RequestRental() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { listing, loading } = useListing(id);
  const unavailable = useUnavailableDates(listing);

  const [days, setDays] = useState<number>(RENTAL_DURATIONS[0]);
  const [startDate, setStartDate] = useState<IsoDate | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseCents = useMemo(() => {
    if (!listing) return null;
    return days === 7 ? listing.pricing.sevenDayCents : listing.pricing.threeDayCents;
  }, [listing, days]);

  const fees = useMemo(
    () =>
      baseCents != null && listing ? calculateFees(baseCents, listing.garmentValueCents) : null,
    [baseCents, listing],
  );

  if (loading) {
    return (
      <Screen flush>
        <Header title="Request" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      </Screen>
    );
  }

  if (!listing || listing.status !== 'active') {
    return (
      <Screen flush>
        <Header title="Request" onBack={() => router.back()} />
        <EmptyState title="Not available" body="That piece is no longer up for rent." />
      </Screen>
    );
  }

  if (listing.ownerUid === profile?.uid) {
    return (
      <Screen flush>
        <Header title="Request" onBack={() => router.back()} />
        <EmptyState title="That's yours" body="You can't rent a piece from your own closet." />
      </Screen>
    );
  }

  const onSend = async () => {
    if (!startDate) return setError('Pick a start date.');
    setSending(true);
    setError(null);
    try {
      const endDate = addDays(startDate, days);
      const result = await requestBooking({
        listingId: listing.id,
        startDate,
        endDate,
        message: message.trim() || undefined,
      });
      logEvent('rental_requested', {
        surface: 'listing',
        targetType: 'booking',
        targetId: result.data.bookingId,
        meta: { days, listingId: listing.id },
      });
      Alert.alert(
        'Request sent',
        `${listing.owner.username} has ${REQUEST_EXPIRY_HOURS} hours to answer. You'll see it in Activity.`,
      );
      router.replace({ pathname: '/rental/[id]', params: { id: result.data.bookingId } });
    } catch (err) {
      setError(callableErrorMessage(err, 'Could not send that request. Try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen flush>
      <Header title="Request to rent" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="h3">{listing.name}</Text>
        <Text variant="bodySmall" tone="secondary" style={styles.owner}>
          From @{listing.owner.username}
        </Text>

        <Text variant="label" style={styles.section}>
          How long
        </Text>
        <View style={styles.row}>
          {RENTAL_DURATIONS.map((option) => {
            const price =
              option === 7 ? listing.pricing.sevenDayCents : listing.pricing.threeDayCents;
            if (price == null) return null;
            return (
              <Chip
                key={option}
                label={`${option} days · ${formatCents(price)}`}
                active={days === option}
                onPress={() => {
                  setDays(option);
                  // A start date that worked for 3 days may not work for
                  // 7, so make her choose again rather than silently
                  // keeping an impossible one.
                  setStartDate(null);
                }}
              />
            );
          })}
        </View>

        <Text variant="label" style={styles.section}>
          Start date
        </Text>
        <Calendar
          unavailable={unavailable}
          durationDays={days}
          selected={startDate}
          onSelect={(date) => {
            setStartDate(date);
            setError(null);
          }}
        />

        {startDate ? (
          <Card style={styles.summary}>
            <Text variant="label">You&apos;d have it</Text>
            <Text style={styles.dates}>
              {formatRange({ startDate, endDate: addDays(startDate, days) })}
            </Text>
            <Text variant="caption" tone="muted">
              Back on{' '}
              {
                formatRange({
                  startDate: addDays(startDate, days),
                  endDate: addDays(startDate, days),
                }).split(' – ')[0]
              }
            </Text>

            {fees ? (
              <View style={styles.breakdown}>
                <Line label={`Rental · ${days} days`} value={formatCents(fees.baseCents)} />
                <Line label="Loane fee" value={formatCents(fees.platformFeeCents)} />
                <Line label="Total" value={formatCents(fees.renterTotalCents)} strong />
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Payments are Phase 5 and are paused until the company is
            registered. Saying so is better than a checkout that isn't. */}
        <Card style={styles.notice}>
          <Text variant="label">Paying for this</Text>
          <Text variant="bodySmall" tone="secondary" style={styles.noticeBody}>
            Loane isn&apos;t taking payments yet. Arrange it with @{listing.owner.username} directly
            — cash, Venmo, whatever suits you both. The total above is what the rental is worth so
            you both have the same number.
          </Text>
        </Card>

        <Input
          label="Message (optional)"
          value={message}
          onChangeText={setMessage}
          placeholder="Tell her what it's for, or when you could collect."
          multiline
          numberOfLines={3}
          style={styles.multiline}
        />

        {error ? (
          <Text variant="bodySmall" tone="error" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Send request"
          onPress={onSend}
          loading={sending}
          disabled={!startDate}
          style={styles.send}
        />
        <Text variant="caption" tone="muted" style={styles.footnote}>
          Nothing is booked until @{listing.owner.username} says yes. She has {REQUEST_EXPIRY_HOURS}{' '}
          hours.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text variant={strong ? 'body' : 'bodySmall'} tone={strong ? 'primary' : 'secondary'}>
        {label}
      </Text>
      <Text variant={strong ? 'body' : 'bodySmall'} style={strong ? styles.strong : undefined}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  owner: { marginTop: 2 },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summary: { marginTop: spacing.lg },
  dates: { marginTop: spacing.xs },
  breakdown: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    gap: spacing.xs,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  strong: { fontWeight: '600' },
  notice: { marginTop: spacing.md, backgroundColor: color.surface.muted },
  noticeBody: { marginTop: spacing.xs },
  multiline: { height: 80, textAlignVertical: 'top', marginTop: spacing.lg },
  error: { marginBottom: spacing.sm },
  send: { marginTop: spacing.sm },
  footnote: { marginTop: spacing.sm, textAlign: 'center' },
});
