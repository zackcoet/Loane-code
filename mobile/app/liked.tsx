/**
 * Looks she has liked.
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { color } from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { PostGrid } from '../src/components/PostGrid';
import { Screen } from '../src/components/Screen';
import { useLikedPosts } from '../src/hooks/useLikedPosts';

export default function Liked() {
  const router = useRouter();
  const { posts, loading } = useLikedPosts();

  return (
    <Screen flush>
      <Header title="Liked" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : posts.length === 0 ? (
        <EmptyState
          title="Nothing liked yet"
          body="Double tap a look you love and it collects here."
          actionLabel="Browse the feed"
          onAction={() => router.replace('/(tabs)/feed')}
        />
      ) : (
        <PostGrid
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
