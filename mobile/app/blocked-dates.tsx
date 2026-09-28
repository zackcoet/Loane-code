/**
 * Block out days on a piece's calendar.
 *
 * For the weekend she wants to wear it herself, or the week she is away.
 * Blocked days are greyed out for renters exactly as booked days are —
 * from a renter's side there is no difference, and there shouldn't be.
 *
 * A day someone has already been confirmed for cannot be blocked. The
 * server refuses it rather than quietly pulling a dress out from under
 * a rental.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  addDays,
  color,
  formatShortDate,
  spacing,
  toIsoDate,
  type IsoDate,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Calendar } from '../src/components/Calendar';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useListing } from '../src/hooks/useListing';
import { setBlockedDates } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';

export default function BlockedDates() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { listing, loading } = useListing(id);

  const [blocked, setBlocked] = useState<IsoDate[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!listing || hydrated) return;
    setBlocked(listing.blackoutDates ?? []);
    setHydrated(true);
  }, [listing, hydrated]);

  // Days taken by a real booking cannot be unblocked or blocked here —
  // they are shown struck through so she can see why a day is not hers
  // to control.
  const booked = useMemo(() => new Set(listing?.bookedDates ?? []), [listing?.bookedDates]);
  const shownAsUnavailable = useMemo(() => new Set([...booked]), [booked]);

  const today = toIsoDate(new Date());
  const upcoming = useMemo(
    () => [...blocked].filter((d) => d >= today).sort(),
    [blocked, today],
  );

  if (loading) {
    return (
      <Screen flush>
        <Header title="Blocked dates" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      </Screen>
    );
  }

  if (!listing || listing.ownerUid !== profile?.uid) {
    return (
      <Screen flush>
        <Header title="Blocked dates" onBack={() => router.back()} />
        <EmptyState title="Not yours" body="You can only change your own listings." />
      </Screen>
    );
  }

  const toggle = (date: IsoDate) => {
    if (booked.has(date)) {
      Alert.alert('Already booked', 'Cancel that rental first if you need the day back.');
      return;
    }
    setBlocked((current) =>
      current.includes(date) ? current.filter((d) => d !== date) : [...current, date],
    );
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await setBlockedDates({ listingId: listing.id, dates: blocked });
      router.back();
    } catch (err) {
      Alert.alert('Loane', callableErrorMessage(err, 'Could not save those dates.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen flush>
      <Header title="Blocked dates" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="bodySmall" tone="secondary">
          Tap a day to block it. Renters can&apos;t request {listing.name} on blocked days.
        </Text>

        <View style={styles.calendar}>
          <Calendar
            unavailable={shownAsUnavailable}
            durationDays={1}
            selected={null}
            onSelect={toggle}
          />
        </View>

        <Card>
          <Text variant="label">Blocked</Text>
          {upcoming.length === 0 ? (
            <Text variant="bodySmall" tone="muted" style={styles.none}>
              Nothing blocked. The piece is available whenever it isn&apos;t booked.
            </Text>
          ) : (
            <View style={styles.chipRow}>
              {upcoming.map((date) => (
                <Chip
                  key={date}
                  label={`${formatShortDate(date)}  ×`}
                  active
                  onPress={() => toggle(date)}
                />
              ))}
            </View>
          )}
        </Card>

        <Button
          label="Quick: block the next 7 days"
          variant="outline"
          onPress={() =>
            setBlocked((current) => {
              const next = new Set(current);
              for (let i = 0; i < 7; i += 1) {
                const day = addDays(today, i);
                if (!booked.has(day)) next.add(day);
              }
              return [...next];
            })
          }
        />

        <Button label="Save" onPress={onSave} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  calendar: { marginTop: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  none: { marginTop: spacing.xs },
});
