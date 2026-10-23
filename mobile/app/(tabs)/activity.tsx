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
 * UPDATES is the notification list, with likes and follows grouped the
 * way Instagram does. It answers "what happened"; Rentals answers "what
 * do I have to do".
 */

import { useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import {
  WORDS,
  TERMINAL_BOOKING_STATUSES,
  color,
  controls,
  groupNotifications,
  notificationTarget,
  spacing,
  type Booking,
} from '@loane/shared';
import { Avatar } from '../../src/components/Avatar';
import { BookingRow, needsMe } from '../../src/components/BookingRow';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadError } from '../../src/components/LoadError';
import { Header } from '../../src/components/Header';
import { IconButton } from '../../src/components/IconButton';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { SkeletonRows } from '../../src/components/Skeleton';
import { useMyBookings } from '../../src/hooks/useBookings';
import { useNotifications } from '../../src/hooks/useNotifications';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';

/** Turns a stored deep link into a route this app can push. */
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
  // Live list: the pull is reassurance, see usePullToRefresh.
  const { refreshControl } = usePullToRefresh();
  const [tab, setTab] = useState<'rentals' | 'updates'>('rentals');

  const lending = useMyBookings('lending');
  const renting = useMyBookings('renting');
  const {
    notifications,
    loading: loadingNotifications,
    failed: notificationsFailed,
    retry: retryNotifications,
    markManyRead,
    hasMore: moreNotifications,
    loadMore: loadMoreNotifications,
    loadingMore: loadingMoreNotifications,
  } = useNotifications();

  const unreadUpdates = notifications.filter((n) => !n.readAt).length;
  // "@ella and 4 others liked your look" — see groupNotifications.
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const markAllRead = () =>
    void markManyRead(notifications.filter((n) => !n.readAt).map((n) => n.id));

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
            /*
              The TAB, not the standalone route. Messages is in the bar
              now, so pushing /messages would stack a second inbox over
              the tabs with the Messages tab sitting unhighlighted
              underneath it.
            */
            onPress={() => router.push('/(tabs)/messages')}
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
        ) : lending.failed || renting.failed ? (
          <LoadError
            what="your rentals"
            onRetry={() => {
              if (lending.failed) lending.retry();
              if (renting.failed) renting.retry();
            }}
          />
        ) : nothingAtAll ? (
          <EmptyState
            title={`Nothing ${WORDS.out} yet`}
            body="Requests on your pieces, and the ones you have asked for, both land here."
            actionLabel="Find something to wear"
            onAction={() => router.push('/(tabs)/discover')}
          />
        ) : (
          <FlatList
            refreshControl={refreshControl}
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
      ) : notificationsFailed ? (
        <LoadError what="your updates" onRetry={retryNotifications} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="Likes, follows, answers, handoffs and reminders will show up here."
          actionLabel="Find closets to follow"
          onAction={() => router.push('/find-friends')}
        />
      ) : (
        <FlatList
          refreshControl={refreshControl}
          data={groups}
          keyExtractor={(g) => g.key}
          ListHeaderComponent={
            unreadUpdates > 0 ? (
              <View style={styles.markAllRow}>
                <Pressable
                  onPress={markAllRead}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all updates as read"
                  hitSlop={8}
                  style={styles.markAll}
                >
                  <Text variant="caption" tone="secondary">
                    Mark all as read
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          contentContainerStyle={styles.list}
          // A page at a time: nearing the bottom brings in the next.
          onEndReached={moreNotifications ? loadMoreNotifications : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMoreNotifications ? (
              <View style={styles.more} accessibilityLabel="Loading more">
                <ActivityIndicator color={color.icon.default} />
              </View>
            ) : null
          }
          renderItem={({ item: group }) => {
            const item = group.lead;
            const unread = group.unread;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={group.title}
                onPress={() => {
                  // A grouped row is read as a whole.
                  void markManyRead(group.members.filter((m) => !m.readAt).map((m) => m.id));
                  const to = notificationTarget(item);
                  if (to) router.push(to as Href);
                }}
                style={({ pressed }) => [
                  styles.row,
                  unread && styles.unread,
                  pressed && styles.pressed,
                ]}
              >
                <Avatar url={item.actorPhotoUrl} name={item.actorUsername} size={40} />
                <View style={styles.rowText}>
                  <Text numberOfLines={2}>{group.title}</Text>
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

/** Both tabs are rows — a booking's piece, or who did something. */
function Loading() {
  return <SkeletonRows avatar={44} />;
}

const styles = StyleSheet.create({
  more: { minHeight: controls.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  markAllRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  markAll: { minHeight: controls.minTapTarget, justifyContent: 'center' },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.accent },
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.role.shared.background },
});
