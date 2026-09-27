/**
 * One rental, from either side.
 *
 * The same screen serves the renter and the lender — what changes is
 * which buttons appear, which is decided by the status and by which side
 * you are on. One screen means the two can never tell different stories
 * about the same booking.
 */

import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  BOOKING_STATUS_LABELS,
  PLATFORM_FEE_BPS,
  RETURN_DISPUTE_WINDOW_HOURS,
  RETURN_PROBLEMS,
  RETURN_PROBLEM_LABELS,
  color,
  controls,
  formatCents,
  formatRange,
  radius,
  spacing,
  type Booking,
  type ImageRef,
} from '@loane/shared';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { Header } from '../../src/components/Header';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { useBooking } from '../../src/hooks/useBookings';
import {
  cancelBooking,
  confirmReceipt,
  confirmReturn,
  flagReturnProblem,
  recordDropoff,
  respondToBooking,
} from '../../src/firebase/callables';
import { callableErrorMessage } from '../../src/firebase/errors';
import { pickPhoto, uploadBookingPhoto } from '../../src/lib/photo';
import { logEvent } from '../../src/analytics/events';

export default function RentalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { booking, loading } = useBooking(id);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <Screen flush>
        <Header title="Rental" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen flush>
        <Header title="Rental" onBack={() => router.back()} />
        <EmptyState title="Not found" body="We couldn't find that rental." />
      </Screen>
    );
  }

  const isLender = booking.lenderUid === profile?.uid;
  const them = isLender ? booking.renter : booking.lender;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, `Could not ${label}. Try again.`));
    } finally {
      setBusy(false);
    }
  };

  const askPhoto = async (): Promise<ImageRef | null> => {
    const source = await new Promise<'camera' | 'library' | null>((resolve) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Take a photo', 'Choose from library'], cancelButtonIndex: 0 },
          (i) => resolve(i === 1 ? 'camera' : i === 2 ? 'library' : null),
        );
      } else {
        Alert.alert('Add a photo', undefined, [
          { text: 'Take a photo', onPress: () => resolve('camera') },
          { text: 'Choose from library', onPress: () => resolve('library') },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ]);
      }
    });
    if (!source || !profile) return null;
    const picked = await pickPhoto(source, 'free');
    if (!picked) return null;
    return uploadBookingPhoto(profile.uid, booking.id, picked, Date.now());
  };

  /**
   * Cancelling asks why, because the other person is left without a
   * dress or without a renter and deserves a reason.
   *
   * Preset reasons rather than a free-text box: Alert.prompt is iOS-only,
   * and a tap is easier than typing when you are cancelling on the way
   * out the door.
   */
  const onCancel = () => {
    const reasons = [
      'My plans changed',
      isLender ? 'The piece is no longer available' : 'I found something else',
      'We could not agree on a handoff',
      'Something else',
    ];

    const choose = (index: number) => {
      const reason = reasons[index];
      if (!reason) return;
      void run('cancel', async () => {
        await cancelBooking({ bookingId: booking.id, reason });
        logEvent('rental_cancelled', {
          surface: 'other',
          targetType: 'booking',
          targetId: booking.id,
        });
      });
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Keep it', ...reasons],
          cancelButtonIndex: 0,
          title: 'Cancel this rental?',
          message: 'They will be told why.',
        },
        (i) => {
          if (i > 0) choose(i - 1);
        },
      );
    } else {
      Alert.alert('Cancel this rental?', 'They will be told why.', [
        ...reasons.map((reason, i) => ({ text: reason, onPress: () => choose(i) })),
        { text: 'Keep it', style: 'cancel' as const },
      ]);
    }
  };

  const onFlagProblem = () => {
    const options = RETURN_PROBLEMS.map((p) => RETURN_PROBLEM_LABELS[p]);
    const choose = async (index: number) => {
      const problem = RETURN_PROBLEMS[index];
      if (!problem) return;
      const photo = await askPhoto();
      if (!photo) {
        Alert.alert('Loane', 'A photo is needed to report a problem.');
        return;
      }
      await run('report that', async () => {
        await flagReturnProblem({
          bookingId: booking.id,
          problem,
          note: RETURN_PROBLEM_LABELS[problem],
          photos: [photo],
        });
        logEvent('rental_disputed', {
          surface: 'other',
          targetType: 'booking',
          targetId: booking.id,
        });
      });
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', ...options], cancelButtonIndex: 0, title: 'What went wrong?' },
        (i) => {
          if (i > 0) void choose(i - 1);
        },
      );
    } else {
      Alert.alert('What went wrong?', undefined, [
        ...RETURN_PROBLEMS.map((p, i) => ({
          text: RETURN_PROBLEM_LABELS[p],
          onPress: () => void choose(i),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <Screen flush>
      <Header title={BOOKING_STATUS_LABELS[booking.status]} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <StatusBanner booking={booking} isLender={isLender} />

        <Card
          style={styles.piece}
          onPress={() =>
            router.push({ pathname: '/listing/[id]', params: { id: booking.listingId } })
          }
          accessibilityLabel={`Open ${booking.listing.name}`}
        >
          {booking.listing.coverUrl ? (
            <Image
              source={{ uri: booking.listing.coverUrl }}
              style={styles.cover}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.pieceText}>
            <Text numberOfLines={1}>{booking.listing.name}</Text>
            {booking.startDate && booking.endDate ? (
              <Text variant="bodySmall" tone="secondary">
                {formatRange({ startDate: booking.startDate, endDate: booking.endDate })}
              </Text>
            ) : null}
          </View>
        </Card>

        <Card style={styles.person} onPress={() => router.push(`/u/${them.username}`)}>
          <Avatar url={them.photoUrl} name={them.displayName} size={44} />
          <View style={styles.personText}>
            <Text variant="caption" tone="muted">
              {isLender ? 'Renting to' : 'Renting from'}
            </Text>
            <Text>@{them.username}</Text>
          </View>
          <Text variant="h3" tone="muted">
            ›
          </Text>
        </Card>

        {booking.renterMessage ? (
          <Card style={styles.block}>
            <Text variant="label">Her message</Text>
            <Text style={styles.blockBody}>{booking.renterMessage}</Text>
          </Card>
        ) : null}

        <Card style={styles.block}>
          <Text variant="label">What it costs</Text>
          <View style={styles.breakdown}>
            <Line label="Rental" value={formatCents(booking.amounts.baseCents)} />
            <Line
              label={`Loane fee (${PLATFORM_FEE_BPS / 100}%)`}
              value={formatCents(booking.amounts.platformFeeCents)}
            />
            <Line label="Total" value={formatCents(booking.amounts.renterTotalCents)} strong />
          </View>
          <Text variant="caption" tone="muted" style={styles.blockBody}>
            Loane isn&apos;t taking payments yet — settle this between yourselves.
          </Text>
        </Card>

        {booking.handoff.dropoffPhotos.length > 0 || booking.handoff.returnPhotos.length > 0 ? (
          <Card style={styles.block}>
            <Text variant="label">Condition photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {[...booking.handoff.dropoffPhotos, ...booking.handoff.returnPhotos].map((p) => (
                <Image key={p.path} source={{ uri: p.url }} style={styles.photo} />
              ))}
            </ScrollView>
          </Card>
        ) : null}

        {booking.returnProblem ? (
          <Card style={[styles.block, styles.problem]}>
            <Text variant="label">Problem reported</Text>
            <Text style={styles.blockBody}>{booking.returnProblem.note}</Text>
            <Text variant="caption" tone="muted">
              Loane is reviewing this.
            </Text>
          </Card>
        ) : null}

        {/* --- What this person can do right now --------------------- */}
        <View style={styles.actions}>
          {booking.status === 'requested' && isLender ? (
            <>
              <Button
                label="Accept"
                loading={busy}
                onPress={() =>
                  void run('accept', async () => {
                    await respondToBooking({ bookingId: booking.id, accept: true });
                    logEvent('rental_confirmed', {
                      surface: 'other',
                      targetType: 'booking',
                      targetId: booking.id,
                    });
                  })
                }
              />
              <Button
                label="Decline"
                variant="outline"
                onPress={() =>
                  void run('decline', async () => {
                    await respondToBooking({ bookingId: booking.id, accept: false });
                    logEvent('rental_declined', {
                      surface: 'other',
                      targetType: 'booking',
                      targetId: booking.id,
                    });
                  })
                }
              />
            </>
          ) : null}

          {booking.status === 'confirmed' && isLender && !booking.handoff.dropoffAt ? (
            <Button
              label="I've dropped it off"
              loading={busy}
              onPress={() =>
                void run('record that', async () => {
                  const photo = await askPhoto();
                  if (!photo) {
                    Alert.alert('Loane', 'A photo of the piece is needed at drop-off.');
                    return;
                  }
                  await recordDropoff({ bookingId: booking.id, photos: [photo] });
                  logEvent('rental_handoff', {
                    surface: 'other',
                    targetType: 'booking',
                    targetId: booking.id,
                  });
                })
              }
            />
          ) : null}

          {booking.status === 'confirmed' && !isLender ? (
            <Button
              label="I have it"
              loading={busy}
              disabled={!booking.handoff.dropoffAt}
              onPress={() =>
                void run('confirm that', async () => {
                  await confirmReceipt({ bookingId: booking.id });
                  logEvent('rental_received', {
                    surface: 'other',
                    targetType: 'booking',
                    targetId: booking.id,
                  });
                })
              }
            />
          ) : null}

          {booking.status === 'with_renter' ? (
            <Button
              label={isLender ? "It's back" : "I've returned it"}
              loading={busy}
              onPress={() =>
                void run('confirm the return', async () => {
                  const photo = isLender ? await askPhoto() : null;
                  await confirmReturn({
                    bookingId: booking.id,
                    ...(photo ? { photos: [photo] } : {}),
                  });
                  logEvent('rental_returned', {
                    surface: 'other',
                    targetType: 'booking',
                    targetId: booking.id,
                  });
                })
              }
            />
          ) : null}

          {booking.status === 'returned' && isLender ? (
            <Button label="Report a problem" variant="outline" onPress={onFlagProblem} />
          ) : null}

          {(booking.status === 'requested' || booking.status === 'confirmed') &&
          !(booking.status === 'requested' && isLender) ? (
            <Button label="Cancel rental" variant="text" onPress={onCancel} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatusBanner({ booking, isLender }: { booking: Booking; isLender: boolean }) {
  const copy: Record<string, string> = {
    requested: isLender
      ? 'She’s asked to rent this. Accept or decline within 48 hours.'
      : 'Waiting on an answer. She has 48 hours.',
    confirmed: booking.handoff.dropoffAt
      ? isLender
        ? 'Dropped off. Waiting for her to confirm she has it.'
        : 'It’s been dropped off — confirm when you have it.'
      : isLender
        ? 'Confirmed. Record the drop-off with a photo when you hand it over.'
        : 'Confirmed. She’ll drop it off and you confirm when you have it.',
    with_renter: isLender ? 'She has it right now.' : 'You have it. Return it by the end date.',
    returned: isLender
      ? `Back with you. You have ${RETURN_DISPUTE_WINDOW_HOURS} hours to report a problem.`
      : 'Returned. It closes automatically in 48 hours.',
    completed: 'All done.',
    declined: booking.declineReason ?? 'Declined.',
    cancelled: booking.cancellationReason ?? 'Cancelled.',
    disputed: 'A problem was reported. Loane is reviewing it.',
  };

  return (
    <Card style={styles.banner}>
      <Text variant="label">{BOOKING_STATUS_LABELS[booking.status]}</Text>
      <Text variant="bodySmall" tone="secondary" style={styles.blockBody}>
        {copy[booking.status]}
      </Text>
    </Card>
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
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  banner: { backgroundColor: color.surface.muted },
  piece: { flexDirection: 'row', alignItems: 'center' },
  cover: { width: 56, height: 72, backgroundColor: color.surface.muted },
  pieceText: { flex: 1, marginLeft: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center' },
  personText: { flex: 1, marginLeft: spacing.md },
  block: {},
  blockBody: { marginTop: spacing.xs },
  breakdown: { marginTop: spacing.sm, gap: spacing.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  strong: { fontWeight: '600' },
  photoRow: { marginTop: spacing.sm },
  photo: {
    width: 88,
    height: 110,
    marginRight: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: color.surface.muted,
  },
  problem: { borderColor: color.border.error },
  actions: { gap: spacing.sm, marginTop: spacing.sm, minHeight: controls.minTapTarget },
});
