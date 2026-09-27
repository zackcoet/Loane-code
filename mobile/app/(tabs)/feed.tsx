/**
 * Feed — the social home.
 *
 * Posts from her campus, newest first, twenty at a time. All Campus shows
 * everyone; Following narrows to closets she follows.
 */

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { color, controls, spacing } from '@loane/shared';
import { CampusChip } from '../../src/components/CampusChip';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton } from '../../src/components/IconButton';
import { Logo } from '../../src/components/Logo';
import { PostCard } from '../../src/components/PostCard';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePagedPosts } from '../../src/hooks/usePagedPosts';
import { useFollowingUids } from '../../src/hooks/useFollowing';
import { logEvent } from '../../src/analytics/events';

export default function Feed() {
  const router = useRouter();
  const { profile } = useAuth();
  const { posts, loading, loadingMore, error, exhausted, refresh, loadMore } = usePagedPosts();
  const { uids: followingUids } = useFollowingUids();
  const [tab, setTab] = useState<'campus' | 'following'>('campus');

  const visible = useMemo(
    () => (tab === 'following' ? posts.filter((p) => followingUids.has(p.authorUid)) : posts),
    [posts, tab, followingUids],
  );

  const onPressTag = useCallback(
    (listingId: string) => {
      // The number that tells us whether the social feed drives rentals.
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

      <View style={styles.tabRow}>
        {(
          [
            ['campus', 'All Campus'],
            ['following', 'Following'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
          >
            <Text variant="label" tone={tab === value ? 'primary' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : error ? (
        <EmptyState title="Couldn't load your feed" body={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No looks yet"
          body={
            tab === 'following'
              ? 'Follow a few closets and their looks show up here.'
              : 'Be the first to post an outfit from your campus.'
          }
          actionLabel={tab === 'campus' ? 'Post a look' : undefined}
          onAction={tab === 'campus' ? () => router.push('/post-look') : undefined}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(post) => post.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={color.icon.default} style={styles.footer} />
            ) : exhausted && visible.length > 0 ? (
              <Text variant="caption" tone="muted" style={styles.end}>
                You&apos;re all caught up
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPressTag={onPressTag}
              onPressAuthor={(username) => router.push(`/u/${username}`)}
              onEdit={
                item.authorUid === profile?.uid
                  ? () => router.push({ pathname: '/edit-post', params: { id: item.id } })
                  : undefined
              }
            />
          )}
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
  filterRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.inverse },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  end: { textAlign: 'center', paddingVertical: spacing.lg },
});
