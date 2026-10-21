/**
 * Inbox — every thread, most recent first.
 *
 * Threads from people she does not follow, that she has never
 * answered, wait behind a "Message requests" row at the top instead of
 * landing among her friends — see isRequestFor. Swipe a thread left to
 * mute or delete it.
 *
 * The search box narrows by name or @username. It filters the threads
 * already loaded rather than querying, because at campus scale her
 * whole inbox is already on the phone and a search that answers on
 * every keystroke beats one that waits for the network.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { color, controls, fonts, radius, spacing, type } from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { ThreadRow } from '../src/components/ThreadRow';
import { useAuth } from '../src/auth/AuthProvider';
import { useInbox } from '../src/hooks/useMessaging';

export default function Messages() {
  const router = useRouter();
  const { profile } = useAuth();
  const { inbox: conversations, requests, loading } = useInbox();
  const [term, setTerm] = useState('');

  const shown = useMemo(() => {
    const q = term.trim().toLowerCase().replace(/^@/, '');
    if (!q) return conversations;
    return conversations.filter((c) => {
      const otherUid = c.participantUids.find((uid) => uid !== profile?.uid);
      const them = otherUid ? c.participants?.[otherUid] : undefined;
      return (
        (them?.username ?? '').toLowerCase().includes(q) ||
        (them?.displayName ?? '').toLowerCase().includes(q)
      );
    });
  }, [conversations, term, profile?.uid]);

  return (
    <Screen flush>
      <Header title="Messages" onBack={() => router.back()} />

      {/* Only once there is something to search. A search box over an
        empty inbox is a question with no possible answer. */}
      {!loading && (conversations.length > 0 || requests.length > 0) ? (
        <View style={styles.searchRow}>
          <Icon name="search" size={18} tint={color.icon.muted} />
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="Search messages by name"
            placeholderTextColor={color.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search messages by name"
            style={styles.search}
          />
          {term ? (
            <Pressable
              onPress={() => setTerm('')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon name="close-circle" size={18} tint={color.icon.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!loading && requests.length > 0 && !term ? (
        <RequestsRow
          count={requests.length}
          unread={requests.some((c) => (c.unreadCounts?.[profile?.uid ?? ''] ?? 0) > 0)}
          onPress={() => router.push('/message-requests')}
        />
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : conversations.length === 0 && requests.length === 0 ? (
        <EmptyState
          title="No messages yet"
          body="Message someone from her profile or a listing to ask about fit or pickup."
        />
      ) : conversations.length === 0 && !term ? (
        <EmptyState
          title="Nothing here yet"
          body="Chats with people you follow show up here. New people are waiting in Message requests."
        />
      ) : shown.length === 0 ? (
        <EmptyState title="Nobody by that name" body="Try her @username." />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ThreadRow
              conversation={item}
              myUid={profile?.uid}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </Screen>
  );
}

/**
 * The way into Message requests. A row rather than a tab, like
 * Instagram: requests are occasional, and a whole tab would make the
 * inbox feel like it had two halves.
 */
function RequestsRow({
  count,
  unread,
  onPress,
}: {
  count: number;
  unread: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Message requests, ${count}`}
      style={({ pressed }) => [styles.requests, pressed && styles.pressed]}
    >
      <Icon name="mail-unread-outline" size={22} tint={color.icon.default} />
      <Text style={styles.requestsLabel}>Message requests</Text>
      {unread ? <View style={styles.dot} /> : null}
      <Text variant="bodySmall" tone="secondary">
        {count}
      </Text>
      <Icon name="chevron-forward" size={18} tint={color.icon.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  requests: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: controls.minTapTarget + 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  requestsLabel: { flex: 1 },
  pressed: { opacity: 0.7 },
  // An unread request: cherry, because it is asking to be answered.
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.button.primary.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: spacing.xxl },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: controls.minTapTarget,
    borderRadius: radius.pill,
    backgroundColor: color.surface.muted,
  },
  search: {
    fontFamily: fonts.body,
    flex: 1,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
});
