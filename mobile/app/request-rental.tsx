/**
 * Request to rent.
 *
 * Pick 3 or 7 days, pick a start date, see what it costs, send the
 * request. The lender then has REQUEST_EXPIRY_HOURS to answer.
 *
 * ON PAYMENT: nothing is charged. During beta the two of them settle up
 * between themselves, and the screen says so plainly rather than
 * implying Loane is holding money it is not.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  SAME_DAY_RESPONSE_HOURS,
  toIsoDate,
  RENTAL_DURATIONS,
  WORDS,
  REQUEST_EXPIRY_HOURS,
  addDays,
  calculateFees,
  priceForDuration,
  color,
  controls,
  radius,
  formatCents,
  formatRange,
  spacing,
  type IsoDate,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Calendar } from '../src/components/Calendar';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { Icon } from '../src/components/Icon';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Input } from '../src/components/Input';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useListing } from '../src/hooks/useListing';
import { useFeatureFlags } from '../src/hooks/useFeatureFlags';
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  /** She must tick this before requesting, when there is a fee to tick. */
  const [cleaningAgreed, setCleaningAgreed] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const baseCents = useMemo(
    () => (listing ? priceForDuration(listing.pricing, days) : null),
    [listing, days],
  );

  /*
    Same day is simply picking today, on a listing whose owner offers
    it. There is no separate mode to turn on — she already said when
    she wants it.
  */
  const isSameDay = startDate === toIsoDate(new Date());
  // Both the owner's yes AND the switchboard: same-day can be paused for
  // everyone without a new app build. The server checks both again.
  const sameDayOn = useFeatureFlags().sameDay;
  const sameDayOffered = sameDayOn && (listing?.sameDay?.enabled ?? false);

  const fees = useMemo(
    () =>
      baseCents != null && listing
        ? calculateFees({
            baseCents,
            garmentValueCents: listing.garmentValueCents,
            cleaningFeeCents: listing.cleaningFeeCents ?? 0,
            sameDay: isSameDay && sameDayOffered,
            sameDayPremiumBps: listing.sameDay?.premiumBps ?? null,
          })
        : null,
    [baseCents, listing, isSameDay, sameDayOffered],
  );

  const cleaningFeeCents = listing?.cleaningFeeCents ?? 0;
  const needsCleaningConsent = cleaningFeeCents > 0;

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          keyboardHeight > 0 && {
            paddingBottom: keyboardHeight + controls.buttonHeight + spacing.lg,
          },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
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

            {/* No Loane line here, on purpose. She pays the listed
                price; our cut comes out of the lender's side. Showing a
                fee she is not paying would be a lie. */}
            {/* Said before she commits, not after. Two hours is a
                promise she is relying on. */}
            {isSameDay && sameDayOffered ? (
              <Text variant="caption" tone="heading" uppercase={false} style={styles.sameDayNote}>
                Same-day pickup. She has {SAME_DAY_RESPONSE_HOURS} hours to answer, or it is
                declined automatically.
              </Text>
            ) : isSameDay ? (
              // Said now, rather than as an error after she taps send.
              <Text variant="caption" tone="heading" uppercase={false} style={styles.sameDayNote}>
                {sameDayOn
                  ? 'This piece isn’t available same day. Pick a later date.'
                  : 'Same-day pickup is paused right now. Pick a later date.'}
              </Text>
            ) : null}

            {fees ? (
              <View style={styles.breakdown}>
                <Line
                  label={`${WORDS.rent} · ${days} ${days === 1 ? 'day' : 'days'}`}
                  value={formatCents(fees.baseCents)}
                />
                {fees.sameDayPremiumCents > 0 ? (
                  <Line label="Same-day" value={formatCents(fees.sameDayPremiumCents)} />
                ) : null}
                {fees.cleaningFeeCents > 0 ? (
                  <Line label="Cleaning" value={formatCents(fees.cleaningFeeCents)} />
                ) : null}
                <Line label="Total" value={formatCents(fees.renterTotalCents)} strong />
              </View>
            ) : null}
          </Card>
        ) : null}

        {needsCleaningConsent ? (
          <Pressable
            onPress={() => setCleaningAgreed((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: cleaningAgreed }}
            style={styles.consent}
          >
            <View style={[styles.checkbox, cleaningAgreed && styles.checkboxOn]}>
              {cleaningAgreed ? (
                <Icon name="checkmark" size={16} tint={color.text.inverse} />
              ) : null}
            </View>
            <Text variant="bodySmall" style={styles.consentText}>
              I agree to the {formatCents(cleaningFeeCents)} cleaning fee. @{listing.owner.username}{' '}
              has it dry-cleaned after every rental and keeps all of it.
            </Text>
          </Pressable>
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
          disabled={!startDate || (needsCleaningConsent && !cleaningAgreed)}
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
  /*
    flex, so the ScrollView has a height of its own inside a flex
    column. Without it, it takes its CONTENT's height, overflows the
    screen and clips instead of scrolling — which is exactly what
    happened on the listing page.
  */
  scroll: { flex: 1 },
  sameDayNote: { marginBottom: spacing.sm },
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
  consent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: color.icon.default, borderColor: color.icon.default },
  consentText: { flex: 1 },
  send: { marginTop: spacing.sm },
  footnote: { marginTop: spacing.sm, textAlign: 'center' },
});
