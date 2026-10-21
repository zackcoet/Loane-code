/**
 * Inbox — every thread, most recent first.
 *
 * The search box narrows by name or @username. It filters the threads
 * already loaded rather than querying, because at campus scale her
 * whole inbox is already on the phone and a search that answers on
 * every keystroke beats one that waits for the network.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  color,
  controls,
  fonts,
  radius,
  spacing,
  timeAgo,
  type,
  type Conversation,
} from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useConversations } from '../src/hooks/useMessaging';

export default function Messages() {
  const router = useRouter();
  const { profile } = useAuth();
  const { conversations, loading } = useConversations();
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
      {!loading && conversations.length > 0 ? (
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

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No messages yet"
          body="Message someone from her profile or a listing to ask about fit or pickup."
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
            <Row
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

function Row({
  conversation,
  myUid,
  onPress,
}: {
  conversation: Conversation;
  myUid: string | undefined;
  onPress: () => void;
}) {
  const otherUid = conversation.participantUids.find((uid) => uid !== myUid);
  const them = otherUid ? conversation.participants?.[otherUid] : undefined;
  const unread = myUid ? (conversation.unreadCounts?.[myUid] ?? 0) : 0;
  const last = conversation.lastMessage;
  const sentAgo = last ? timeAgo(last.sentAt) : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat with @${them?.username ?? 'student'}`}
      style={({ pressed }) => [
        styles.row,
        unread > 0 && styles.unreadRow,
        pressed && styles.pressed,
      ]}
    >
      <Avatar url={them?.photoUrl} name={them?.displayName} size={48} />
      <View style={styles.rowText}>
        <Text numberOfLines={1}>@{them?.username ?? 'student'}</Text>
        <View style={styles.previewRow}>
          <Text
            variant="bodySmall"
            tone={unread > 0 ? 'primary' : 'secondary'}
            numberOfLines={1}
            style={styles.preview}
          >
            {/* "You: " on her own last message, so a glance tells her
              whose turn it is. */}
            {last && last.senderUid === myUid ? 'You: ' : ''}
            {last?.body || 'Say hello'}
          </Text>
          {sentAgo ? (
            <Text variant="bodySmall" tone="muted" numberOfLines={1}>
              {' '}
              · {sentAgo}
            </Text>
          ) : null}
        </View>
      </View>
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text variant="caption" tone="inverse">
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
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
  unreadRow: { backgroundColor: color.surface.muted },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, marginLeft: spacing.md },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { flexShrink: 1 },
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
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.role.shared.background,
  },
});
