/**
 * Inbox — every thread, most recent first.
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, spacing, type Conversation } from '@loane/shared';
import { Avatar } from '../src/components/Avatar';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useConversations } from '../src/hooks/useMessaging';

export default function Messages() {
  const router = useRouter();
  const { profile } = useAuth();
  const { conversations, loading } = useConversations();

  return (
    <Screen flush>
      <Header title="Messages" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No messages yet"
          body="Message someone from her profile or a listing to ask about fit or pickup."
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Row
              conversation={item}
              myUid={profile?.uid}
              onPress={() =>
                router.push({ pathname: '/chat/[id]', params: { id: item.id } })
              }
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

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat with @${them?.username ?? 'student'}`}
      style={({ pressed }) => [styles.row, unread > 0 && styles.unreadRow, pressed && styles.pressed]}
    >
      <Avatar url={them?.photoUrl} name={them?.displayName} size={48} />
      <View style={styles.rowText}>
        <Text numberOfLines={1}>@{them?.username ?? 'student'}</Text>
        <Text variant="bodySmall" tone={unread > 0 ? 'primary' : 'secondary'} numberOfLines={1}>
          {conversation.lastMessage?.body ?? 'Say hello'}
        </Text>
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
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.inverse,
  },
});
