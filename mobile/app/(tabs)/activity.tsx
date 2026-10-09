/**
 * Activity — your rentals, and everything waiting on you.
 *
 * Two tabs. RENTALS opens first and is the one that matters: the
 * calendar, the accept/decline, the "where is my dress" all existed
 * already, buried in the side menu under My Rentals, and Ella could
 * not find any of it. Booking is what Loane does; it should not be
 * three taps into a hamburger.
 *
 * Most people here are both a lender and a renter — she lends her
 * formal and rents somebody's boots the same weekend — so both are on
 * one screen rather than behind a mode switch, with anything needing
 * an answer lifted to the top under "Needs you".
 *
 * UPDATES is the old notification list, unchanged. It answers "what
 * happened"; Rentals answers "what do I have to do".
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import {
  TERMINAL_BOOKING_STATUSES,
  color,
  controls,
  spacing,
  type Booking,
  type Notification,
} from '@loane/shared';
import { Avatar } from '../../src/components/Avatar';
import { BookingRow, needsMe } from '../../src/components/BookingRow';
import { EmptyState } from '../../src/components/EmptyState';
import { Header } from '../../src/components/Header';
import { IconButton } from '../../src/components/IconButton';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useMyBookings } from '../../src/hooks/useBookings';
import { useNotifications } from '../../src/hooks/useNotifications';

/** Turns a stored deep link into a route this app can push. */
function target(
  notification: Notification,
): { pathname: '/rental/[id]'; params: { id: string } } | null {
  const bookingId = notification.refs?.bookingId;
  return bookingId ? { pathname: '/rental/[id]', params: { id: bookingId } } : null;
}

function ago(value: unknown): string {
  const date =
    value && typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)
      ? (value as { toDate: () => Date }).toDate()
      : null;
  if (!date) return '';

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

type Row =
  | { kind: 'header'; title: string; note?: string }
  | { kind: 'booking'; booking: Booking; isLender: boolean };

export default function Activity() {
  const router = useRouter();
  const [tab, setTab] = useState<'rentals' | 'updates'>('rentals');

  const lending = useMyBookings('lending');
  const renting = useMyBookings('renting');
  const { notifications, loading: loadingNotifications, markRead } = useNotifications();

  const unreadUpdates = notifications.filter((n) => !n.readAt).length;

  const rows = useMemo<Row[]>(() => {
    const live = (bookings: Booking[]) =>
      bookings.filter((b) => !TERMINAL_BOOKING_STATUSES.includes(b.status));

    const lendingLive = live(lending.bookings);
    const rentingLive = live(renting.bookings);

    // Anything waiting on her, from either side, lifted out and put
    // first. This is the answer to "is anybody waiting on me?", which
    // is the question you open the app with.
    const waiting: Row[] = [
      ...lendingLive
        .filter((b) => needsMe(b, true))
        .map((b) => ({ kind: 'booking' as const, booking: b, isLender: true })),
      ...rentingLive
        .filter((b) => needsMe(b, false))
        .map((b) => ({ kind: 'booking' as const, booking: b, isLender: false })),
    ];

    const lendingRest = lendingLive.filter((b) => !needsMe(b, true));
    const rentingRest = rentingLive.filter((b) => !needsMe(b, false));

    const out: Row[] = [];
    if (waiting.length > 0) {
      out.push({
        kind: 'header',
        title: 'Needs you',
        note: `${waiting.length} ${waiting.length === 1 ? 'thing is' : 'things are'} waiting on you`,
      });
      out.push(...waiting);
    }

    out.push({
      kind: 'header',
      title: 'Lending',
      note:
        lendingRest.length === 0
          ? 'Pieces you have lent out show up here.'
          : `${lendingRest.length} out or upcoming`,
    });
    out.push(...lendingRest.map((b) => ({ kind: 'booking' as const, booking: b, isLender: true })));

    out.push({
      kind: 'header',
      title: 'Renting',
      note:
        rentingRest.length === 0
          ? 'Pieces you have asked for show up here.'
          : `${rentingRest.length} requested or with you`,
    });
    out.push(
      ...rentingRest.map((b) => ({ kind: 'booking' as const, booking: b, isLender: false })),
    );

    return out;
  }, [lending.bookings, renting.bookings]);

  const nothingAtAll =
    lending.bookings.length === 0 &&
    renting.bookings.length === 0 &&
    !lending.loading &&
    !renting.loading;

  return (
    <Screen flush>
      <Header
        title="Activity"
        right={
          <IconButton
            name="chatbubble-outline"
            onPress={() => router.push('/messages')}
            accessibilityLabel="Messages"
          />
        }
      />

      <View style={styles.tabRow}>
        {(
          [
            ['rentals', 'Rentals'],
            ['updates', unreadUpdates > 0 ? `Updates (${unreadUpdates})` : 'Updates'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            style={[styles.tab, tab === value && styles.tabActive]}
          >
            <Text variant="label" tone={tab === value ? 'primary' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'rentals' ? (
        lending.loading || renting.loading ? (
          <Loading />
        ) : nothingAtAll ? (
          <EmptyState
            title="No rentals yet"
            body="Requests on your pieces, and the ones you have asked for, both land here."
            actionLabel="Find something to rent"
            onAction={() => router.push('/(tabs)/discover')}
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(row, i) => (row.kind === 'header' ? `h-${i}` : row.booking.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) =>
              item.kind === 'header' ? (
                <View style={styles.section}>
                  <Text variant="label" tone="secondary">
                    {item.title}
                  </Text>
                  {item.note ? (
                    <Text variant="caption" tone="muted" uppercase={false} style={styles.note}>
                      {item.note}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <BookingRow
                  booking={item.booking}
                  isLender={item.isLender}
                  onPress={() =>
                    router.push({ pathname: '/rental/[id]', params: { id: item.booking.id } })
                  }
                />
              )
            }
          />
        )
      ) : loadingNotifications ? (
        <Loading />
      ) : notifications.length === 0 ? (
        <EmptyState title="Nothing yet" body="Answers, handoffs and reminders will show up here." />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const unread = !item.readAt;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => {
                  void markRead(item.id);
                  const to = target(item);
                  if (to) router.push(to);
                }}
                style={({ pressed }) => [
                  styles.row,
                  unread && styles.unread,
                  pressed && styles.pressed,
                ]}
              >
                <Avatar url={item.actorPhotoUrl} name={item.actorUsername} size={40} />
                <View style={styles.rowText}>
                  <Text numberOfLines={1}>{item.title}</Text>
                  <Text variant="bodySmall" tone="secondary">
                    {item.body}
                  </Text>
                </View>
                <View style={styles.meta}>
                  <Text variant="caption" tone="muted">
                    {ago(item.createdAt)}
                  </Text>
                  {unread ? <View style={styles.dot} /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={color.icon.default} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.accent },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  section: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  note: { marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: controls.minTapTarget,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  unread: { backgroundColor: color.surface.muted },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  meta: { alignItems: 'flex-end', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.attention.background },
});
