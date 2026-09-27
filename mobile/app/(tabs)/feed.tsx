/**
 * Feed — the social home. Outfit posts from her campus.
 *
 * Posts come live from Firestore, scoped to her campusId and to active
 * status. Tapping a tagged garment logs `tagged_item_tap`, which is the
 * headline metric for MVP question 2: the social side handing the
 * marketplace a customer.
 */

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import {
  color,
  controls,
  spacing,
} from '@loane/shared';
import { CampusChip } from '../../src/components/CampusChip';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton } from '../../src/components/IconButton';
import { Logo } from '../../src/components/Logo';
import { PostCard } from '../../src/components/PostCard';
import { Screen } from '../../src/components/Screen';
import { usePosts } from '../../src/hooks/useFeed';
import { logEvent } from '../../src/analytics/events';

export default function Feed() {
  const router = useRouter();
  const { items: posts, loading, error } = usePosts();

  const onPressTag = useCallback(
    (listingId: string) => {
      // The metric that tells us whether the social feed drives rentals.
      logEvent('tagged_item_tap', {
        surface: 'feed',
        targetType: 'listing',
        targetId: listingId,
      });
      router.push({ pathname: '/listing/[id]', params: { id: listingId } });
    },
    [router],
  );

  return (
    <Screen flush>
      <View style={styles.header}>
        <IconButton glyph="≡" onPress={() => router.push('/menu')} accessibilityLabel="Open menu" />
        <Logo size={30} lockup="below" />
        <IconButton
          glyph="⌕"
          onPress={() => router.push('/(tabs)/discover')}
          accessibilityLabel="Search"
        />
      </View>

      <View style={styles.filterRow}>
        <CampusChip />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : error ? (
        <EmptyState title="Couldn't load your feed" body={error} />
      ) : posts.length === 0 ? (
        <EmptyState
          title="No looks yet"
          body="Be the first to post an outfit from your campus."
          actionLabel="Post a look"
          onAction={() => router.push('/post-sheet')}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPressTag={onPressTag}
              onPressAuthor={(username) => router.push(`/u/${username}`)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: controls.headerHeight + 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
});
