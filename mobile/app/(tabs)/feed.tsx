/**
 * Feed — the social home.
 *
 * Posts from her campus, newest first, twenty at a time. All Campus shows
 * everyone; Following narrows to closets she follows.
 */

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePostDraft } from '../../src/post/postDraft';
import { startLook } from '../../src/post/startLook';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { color, controls, radius, spacing } from '@loane/shared';
import { CampusChip } from '../../src/components/CampusChip';
import { EmptyState } from '../../src/components/EmptyState';
import { IconButton } from '../../src/components/IconButton';
import { Logo } from '../../src/components/Logo';
import { LoaneLoader } from '../../src/components/LoaneLoader';
import { PostCard } from '../../src/components/PostCard';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePagedPosts } from '../../src/hooks/usePagedPosts';
import { useFollowingUids } from '../../src/hooks/useFollowing';
import { useUnreadMessageCount } from '../../src/hooks/useMessaging';
import { useOpenChat } from '../../src/hooks/useOpenChat';
import { useHiddenUids } from '../../src/hooks/useBlocks';
import { logEvent } from '../../src/analytics/events';

export default function Feed() {
  const router = useRouter();
  const draft = usePostDraft();
  const unreadMessages = useUnreadMessageCount();
  const { profile } = useAuth();
  const { posts, loading, loadingMore, error, exhausted, refresh, loadMore } = usePagedPosts();
  const { uids: followingUids } = useFollowingUids();
  const hidden = useHiddenUids();
  const chat = useOpenChat();
  const [tab, setTab] = useState<'campus' | 'following'>('campus');
  const closetTitle = profile?.firstName ? `${profile.firstName}s Closet` : 'Your Closet';

  const visible = useMemo(() => {
    // Blocked either way: her looks simply are not in the feed. This is
    // the on-device half of blocking — see docs/security.md.
    const shown = posts.filter((p) => !hidden.has(p.authorUid));
    return tab === 'following' ? shown.filter((p) => followingUids.has(p.authorUid)) : shown;
  }, [posts, tab, followingUids, hidden]);

  const onPressTag = useCallback(
    (listingId: string, postId: string) => {
      // The number that tells us whether the social feed drives rentals.
      // The listing is the target because that is what the tap opens;
      // postId rides along so the post gets credited too.
      logEvent('tagged_item_tap', {
        surface: 'feed',
        targetType: 'listing',
        targetId: listingId,
        meta: { postId },
      });
      router.push({ pathname: '/listing/[id]', params: { id: listingId } });
    },
    [router],
  );

  return (
    <Screen flush>
      {/* Menu left, mark centred, messages right — Instagram's shape,
          and what Ella's mockup draws. The mark is our own Logo
          component rather than the mockup's image, which clips the L
          and the E. */}
      <View style={styles.header}>
        <IconButton
          name="menu"
          onPress={() => router.push('/menu')}
          accessibilityLabel="Open menu"
        />
        <View style={styles.logoLift}>
          <Logo size={30} lockup="below" tint={color.text.heading} />
        </View>
        <View>
          <IconButton
            name="chatbubble-outline"
            onPress={() => router.push('/messages')}
            accessibilityLabel={
              unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'
            }
          />
          {/* A dot, not a count. The number is in the list; out here
              all she needs to know is that there is something. */}
          {unreadMessages > 0 ? <View style={styles.unreadDot} /> : null}
        </View>
      </View>

      <View style={styles.campusRow}>
        <CampusChip />
      </View>

      <View style={styles.titleRow}>
        <Text
          variant="display"
          tone="heading"
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {closetTitle}
        </Text>
        <View style={styles.toggle}>
          {(
            [
              ['campus', 'All'],
              ['following', 'Following'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              style={[styles.toggleOption, tab === value && styles.toggleOptionOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
            >
              <Text
                variant="bodySmall"
                tone={tab === value ? 'inverse' : 'heading'}
                uppercase={false}
                style={styles.toggleLabel}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <LoaneLoader size={34} />
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
          // An empty Following tab used to be a dead end. The only way
          // out of it is to go and find someone to follow.
          actionLabel={tab === 'campus' ? 'Post a look' : 'Find closets to follow'}
          onAction={
            tab === 'campus'
              ? () => void startLook(draft, router.push)
              : () => router.push('/(tabs)/discover')
          }
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
              onPressTag={(listingId) => onPressTag(listingId, item.id)}
              onPressAuthor={(username) => router.push(`/u/${username}`)}
              onPressComments={() =>
                router.push({
                  pathname: '/comments',
                  params: { postId: item.id, postAuthorUid: item.authorUid },
                })
              }
              onPressSend={() =>
                router.push({ pathname: '/send-post', params: { postId: item.id } })
              }
              onPressLikes={() =>
                router.push({ pathname: '/post-likes', params: { postId: item.id } })
              }
              onMessageSeller={(ownerUid, listingId) => void chat.open(ownerUid, { listingId })}
              isMine={item.authorUid === profile?.uid}
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
    height: controls.headerHeight + 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  logoLift: { transform: [{ translateY: -4 }] },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: color.role.renter.background,
  },
  campusRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { flex: 1 },
  // A cream track with a merlot pill sliding in it.
  toggle: {
    flexShrink: 0,
    flexDirection: 'row',
    backgroundColor: color.surface.section,
    borderRadius: radius.pill,
    padding: 4,
  },
  toggleOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  toggleOptionOn: { backgroundColor: color.role.shared.background },
  toggleLabel: { fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The feed body is the cream band; the cards are white on top of it.
  list: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: color.surface.section,
  },
  footer: { paddingVertical: spacing.lg },
  end: { textAlign: 'center', paddingVertical: spacing.lg },
});
