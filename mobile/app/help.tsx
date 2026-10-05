import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import {
  BOOKING_STATUS_LABELS,
  LIMITS,
  brand,
  color,
  controls,
  formatRange,
  radius,
  spacing,
  type Booking,
  type ImageRef,
  type ReportReason,
  type SupportTopic,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Chip } from '../src/components/Chip';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Input } from '../src/components/Input';
import { PhotoGrid } from '../src/components/PhotoGrid';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { submitReport, submitSupportRequest } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { pickPhoto, uploadBookingPhoto, type PickedPhoto } from '../src/lib/photo';
import { useMyBookings } from '../src/hooks/useBookings';
import { useMyReports, useMySupportRequests } from '../src/hooks/useSupport';

const ISSUE_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'item_damaged', label: 'Item damaged' },
  { value: 'never_received', label: 'Never received the item' },
  { value: 'item_not_returned', label: 'Item not returned' },
  { value: 'item_stolen_or_lost', label: 'Item stolen or lost' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'other', label: 'Other' },
];

const TOPICS: { value: SupportTopic; label: string }[] = [
  { value: 'account_help', label: 'Account help' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'bug', label: 'Bug' },
  { value: 'other', label: 'Other' },
];

const FAQ = [
  {
    title: 'How renting works',
    body: 'Request a piece for your dates. The lender accepts, you meet on campus, then both sides confirm handoff and return in Loane.',
  },
  {
    title: 'How payment works during beta',
    body: 'No money moves through Loane yet. The app shows the price, and you settle directly while we finish payments and protection.',
  },
  {
    title: 'How to cancel',
    body: 'Open the rental and tap Cancel rental before handoff. Once the item changes hands, message the other person and contact us if you need help.',
  },
];

export default function Help() {
  const router = useRouter();
  const { profile } = useAuth();
  const renting = useMyBookings('renting');
  const lending = useMyBookings('lending');
  const reports = useMyReports();
  const support = useMySupportRequests();

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [issue, setIssue] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [reporting, setReporting] = useState(false);
  const [topic, setTopic] = useState<SupportTopic>('account_help');
  const [message, setMessage] = useState('');
  const [contacting, setContacting] = useState(false);

  const bookings = useMemo(
    () => [
      ...renting.bookings.map((booking) => ({ booking, side: 'Renting' as const })),
      ...lending.bookings.map((booking) => ({ booking, side: 'Lending' as const })),
    ],
    [lending.bookings, renting.bookings],
  );
  const selected = bookings.find((row) => row.booking.id === selectedBookingId)?.booking ?? null;

  const addPhoto = async () => {
    if (photos.length >= 4) return;
    const photo = await pickPhoto('library', 'free');
    if (photo) setPhotos((current) => [...current, photo]);
  };

  const submitRentalReport = async () => {
    if (!profile || !selected || !issue) return;
    setReporting(true);
    try {
      const uploaded: ImageRef[] = [];
      for (const [index, photo] of photos.entries()) {
        uploaded.push(await uploadBookingPhoto(profile.uid, selected.id, photo, Date.now() + index));
      }
      await submitReport({
        targetType: 'booking',
        targetId: selected.id,
        reason: issue,
        details,
        photos: uploaded,
      });
      setSelectedBookingId(null);
      setIssue(null);
      setDetails('');
      setPhotos([]);
      Alert.alert('We got it', "We'll get back to you within 48 hours.");
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, 'Could not send that report.'));
    } finally {
      setReporting(false);
    }
  };

  const submitContact = async () => {
    setContacting(true);
    try {
      await submitSupportRequest({ topic, message });
      setMessage('');
      setTopic('account_help');
      Alert.alert('We got it', "We'll get back to you within 48 hours.");
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, 'Could not send that message.'));
    } finally {
      setContacting(false);
    }
  };

  return (
    <Screen flush scroll>
      <Header title="Help & Support" onBack={() => router.back()} />
      <View style={styles.content}>
        <Text variant="label" tone="muted" style={styles.sectionLabelTop}>
          Report a problem with a rental
        </Text>
        <View style={styles.panel}>
          {bookings.length === 0 && !renting.loading && !lending.loading ? (
            <EmptyState title="No rentals yet" body="Your Renting and Lending history will appear here." />
          ) : (
            <View style={styles.stack}>
              {bookings.map(({ booking, side }) => (
                <RentalChoice
                  key={`${side}-${booking.id}`}
                  booking={booking}
                  side={side}
                  selected={selectedBookingId === booking.id}
                  onPress={() => setSelectedBookingId(booking.id)}
                />
              ))}
            </View>
          )}

          <Text variant="label" tone="muted" style={styles.subLabel}>
            What happened
          </Text>
          <View style={styles.chips}>
            {ISSUE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={issue === option.value}
                onPress={() => setIssue(option.value)}
              />
            ))}
          </View>

          {issue === 'item_stolen_or_lost' ? (
            <View style={styles.notice}>
              <Text variant="bodySmall" tone="secondary">
                If you feel unsafe or think the item was stolen, contact campus police or call 911.
              </Text>
            </View>
          ) : null}

          <Input
            label="Description"
            value={details}
            onChangeText={setDetails}
            placeholder="Tell us what happened."
            multiline
            numberOfLines={4}
            maxLength={LIMITS.reportDetails.max}
            style={styles.multiline}
            hint={`${details.length}/${LIMITS.reportDetails.max}`}
          />

          <Text variant="label" tone="muted" style={styles.subLabel}>
            Photos optional
          </Text>
          <PhotoGrid
            photos={photos}
            max={4}
            onAdd={addPhoto}
            onRemove={(index) => setPhotos((current) => current.filter((_, i) => i !== index))}
            onMakeCover={(index) =>
              setPhotos((current) => [current[index]!, ...current.filter((_, i) => i !== index)])
            }
            busy={reporting}
          />

          <Button
            label="Submit rental report"
            variant="dark"
            onPress={submitRentalReport}
            loading={reporting}
            disabled={!selectedBookingId || !issue || details.trim().length === 0}
            style={styles.button}
          />
        </View>

        <Text variant="label" tone="muted" style={styles.sectionLabel}>
          Contact us
        </Text>
        <View style={styles.panel}>
          <View style={styles.chips}>
            {TOPICS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={topic === option.value}
                onPress={() => setTopic(option.value)}
              />
            ))}
          </View>
          <Input
            label="Message"
            value={message}
            onChangeText={setMessage}
            placeholder="What can we help with?"
            multiline
            numberOfLines={4}
            maxLength={LIMITS.supportMessage.max}
            style={styles.multiline}
            hint={`${message.length}/${LIMITS.supportMessage.max}`}
          />
          <Button
            label="Send message"
            onPress={submitContact}
            loading={contacting}
            disabled={message.trim().length === 0}
          />
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`mailto:${brand.supportEmail}`)}
            style={styles.emailLink}
          >
            <Text variant="body">{brand.supportEmail}</Text>
          </Pressable>
        </View>

        <Text variant="label" tone="muted" style={styles.sectionLabel}>
          FAQ
        </Text>
        <View style={styles.stack}>
          {FAQ.map((item) => (
            <View key={item.title} style={styles.panel}>
              <Text variant="body" style={styles.title}>
                {item.title}
              </Text>
              <Text variant="bodySmall" tone="secondary" style={styles.body}>
                {item.body}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="label" tone="muted" style={styles.sectionLabel}>
          Past reports
        </Text>
        <View style={styles.panel}>
          {reports.reports.length === 0 && support.requests.length === 0 ? (
            <Text variant="bodySmall" tone="secondary">
              Your submitted reports and support messages will appear here.
            </Text>
          ) : (
            <View style={styles.stack}>
              {reports.reports.map((report) => (
                <StatusRow
                  key={`report-${report.id}`}
                  title={report.targetType === 'booking' ? 'Rental report' : 'Report'}
                  detail={humanize(report.reason)}
                  status={humanize(report.status)}
                />
              ))}
              {support.requests.map((request) => (
                <StatusRow
                  key={`support-${request.id}`}
                  title="Support message"
                  detail={humanize(request.topic)}
                  status={humanize(request.status)}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

function RentalChoice({
  booking,
  side,
  selected,
  onPress,
}: {
  booking: Booking;
  side: 'Renting' | 'Lending';
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
    >
      <View style={styles.choiceText}>
        <Text variant="body" numberOfLines={1} style={styles.title}>
          {booking.listing.name}
        </Text>
        <Text variant="bodySmall" tone="secondary">
          {side} · {BOOKING_STATUS_LABELS[booking.status]}
        </Text>
        {booking.startDate && booking.endDate ? (
          <Text variant="caption" tone="muted">
            {formatRange({ startDate: booking.startDate, endDate: booking.endDate })}
          </Text>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]} />
    </Pressable>
  );
}

function StatusRow({ title, detail, status }: { title: string; detail: string; status: string }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.choiceText}>
        <Text variant="body" style={styles.title}>
          {title}
        </Text>
        <Text variant="bodySmall" tone="secondary">
          {detail}
        </Text>
      </View>
      <Text variant="label">{status}</Text>
    </View>
  );
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionLabelTop: { marginBottom: spacing.sm },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  subLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  panel: {
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: color.surface.page,
  },
  stack: { gap: spacing.sm },
  choice: {
    minHeight: controls.minTapTarget,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.sm,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  choiceSelected: { borderColor: color.border.inverse },
  choiceText: { flex: 1 },
  title: { fontWeight: '600' },
  pressed: { opacity: 0.75 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: color.border.default,
  },
  radioSelected: {
    borderWidth: 5,
    borderColor: color.border.inverse,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notice: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.sm,
    backgroundColor: color.surface.muted,
    padding: spacing.sm,
  },
  multiline: { height: 104, textAlignVertical: 'top' },
  button: { marginTop: spacing.lg },
  emailLink: {
    minHeight: controls.minTapTarget,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  body: { marginTop: 4 },
  statusRow: {
    minHeight: controls.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
