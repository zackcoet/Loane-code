/**
 * Looks she has liked.
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { color } from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { LoadError } from '../src/components/LoadError';
import { Header } from '../src/components/Header';
import { PostGrid } from '../src/components/PostGrid';
import { Screen } from '../src/components/Screen';
import { useLikedPosts } from '../src/hooks/useLikedPosts';
import { usePullToRefresh } from '../src/hooks/usePullToRefresh';

export default function Liked() {
  const router = useRouter();
  // Live list: the pull is reassurance, see usePullToRefresh.
  const { refreshControl } = usePullToRefresh();
  const { posts, loading, failed, retry } = useLikedPosts();

  return (
    <Screen flush>
      <Header title="Liked" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : failed ? (
        <LoadError what="your liked looks" onRetry={retry} />
      ) : posts.length === 0 ? (
        <EmptyState
          title="Nothing liked yet"
          body="Double tap a look you love and it collects here."
          actionLabel="Browse the feed"
          onAction={() => router.replace('/(tabs)/feed')}
        />
      ) : (
        <PostGrid
          refreshControl={refreshControl}
          posts={posts}
          onPress={(id) => router.push({ pathname: '/post/[id]', params: { id } })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
