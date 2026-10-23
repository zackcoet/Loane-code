/**
 * Message requests — chats from people she does not follow that she has
 * not answered yet.
 *
 * Nothing here adds to her Messages badge. Opening one does not tell
 * the sender anything new beyond the usual "Seen"; replying moves the
 * chat into her inbox, and deleting it removes it for her only.
 */

import { useRouter } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';
import { spacing } from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { LoadError } from '../src/components/LoadError';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { ThreadRow } from '../src/components/ThreadRow';
import { SkeletonRows } from '../src/components/Skeleton';
import { useAuth } from '../src/auth/AuthProvider';
import { useInbox } from '../src/hooks/useMessaging';
import { usePullToRefresh } from '../src/hooks/usePullToRefresh';

export default function MessageRequests() {
  const router = useRouter();
  // Live list: the pull is reassurance, see usePullToRefresh.
  const { refreshControl } = usePullToRefresh();
  const { profile } = useAuth();
  const { requests, loading, failed, retry } = useInbox();

  return (
    <Screen flush>
      <Header title="Message requests" onBack={() => router.back()} />
      {loading ? (
        <SkeletonRows avatar={52} />
      ) : failed ? (
        <LoadError what="your message requests" onRetry={retry} />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No requests"
          body="When someone you don't follow messages you, it waits here until you reply."
        />
      ) : (
        <FlatList
          refreshControl={refreshControl}
          data={requests}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text variant="bodySmall" tone="secondary" style={styles.note}>
              These are from people you don&apos;t follow. Reply to move a chat to your messages.
            </Text>
          }
          renderItem={({ item }) => (
            <ThreadRow
              conversation={item}
              myUid={profile?.uid}
              canMute={false}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  note: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
