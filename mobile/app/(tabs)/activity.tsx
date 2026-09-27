/**
 * Activity — everything waiting on you.
 *
 * Rental requests, answers, cancellations and handoffs land here.
 * Push notifications are Phase 6, so until then this list and the badge
 * on the tab bar are the only way anyone finds out something happened.
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, spacing, type Notification } from '@loane/shared';
import { Avatar } from '../../src/components/Avatar';
import { EmptyState } from '../../src/components/EmptyState';
import { Header } from '../../src/components/Header';
import { IconButton } from '../../src/components/IconButton';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useNotifications } from '../../src/hooks/useNotifications';

/** Turns a stored deep link into a route this app can push. */
function target(notification: Notification): { pathname: '/rental/[id]'; params: { id: string } } | null {
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

export default function Activity() {
  const router = useRouter();
  const { notifications, loading, markRead } = useNotifications();

  return (
    <Screen flush>
      <Header
        title="Activity"
        right={
          <IconButton
            glyph="✉"
            onPress={() => router.push('/messages')}
            accessibilityLabel="Messages"
          />
        }
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No activity yet"
          body="Rental requests, answers and handoffs will show up here."
        />
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

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: controls.minTapTarget + 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  unread: { backgroundColor: color.surface.muted },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, marginLeft: spacing.md },
  meta: { alignItems: 'flex-end', gap: 6, marginLeft: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.surface.inverse },
});
