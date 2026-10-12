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
import { ProfileGateSheet } from '../../src/components/ProfileGateSheet';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePagedPosts } from '../../src/hooks/usePagedPosts';
import { useFollowingUids } from '../../src/hooks/useFollowing';
import { useUnreadMessageCount } from '../../src/hooks/useMessaging';
import { useSuggestedClosets } from '../../src/hooks/useSuggestedClosets';
import { useWalkthrough } from '../../src/hooks/useWalkthrough';
import { Walkthrough } from '../../src/components/Walkthrough';
import { useWalkthroughTargets } from '../../src/components/WalkthroughTargets';
import { useProfileGate } from '../../src/hooks/useProfileGate';
import { SuggestedClosets } from '../../src/components/SuggestedClosets';
import { useOpenChat } from '../../src/hooks/useOpenChat';
import { useHiddenUids } from '../../src/hooks/useBlocks';
import { logEvent } from '../../src/analytics/events';

/**
 * How far down the feed the suggestions row goes.
 *
 * Eight posts in: far enough that she has seen what the app is for
 * before being asked to follow anyone, close enough that she reaches
 * it in a normal session.
 */
const SUGGESTIONS_AFTER = 8;

/**
 * Where it actually lands.
 *
 * On a short feed, eight posts in is never — and a short feed is
 * exactly when she most needs closets to follow. A campus with four
 * posts is a campus where following people is the whole job. So it
 * falls back to the last position the feed has.
 */
function suggestionsIndex(postCount: number): number {
  return Math.min(SUGGESTIONS_AFTER, Math.max(postCount - 1, 0));
}

export default function Feed() {
  const router = useRouter();
  const draft = usePostDraft();
  const unreadMessages = useUnreadMessageCount();
  const suggested = useSuggestedClosets();
  const gate = useProfileGate();
  /*
    Here rather than on a screen of its own: the tour points at the tab
    bar, and the tab bar only exists once she is inside the app. The
    feed is where she lands after signing up.
  */
  const tour = useWalkthrough();
  const tourTargets = useWalkthroughTargets();
  const { profile } = useAuth();
  const { posts, loading, loadingMore, error, exhausted, refresh, loadMore } = usePagedPosts();
  const { uids: followingUids } = useFollowingUids();
  const hidden = useHiddenUids();
  const chat = useOpenChat();
  const [tab, setTab] = useState<'campus' | 'following'>('campus');

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

      {/*
        TWO FULL-WIDTH TABS, which is what Ella asked to go back to.

        The headline and the pill toggle are gone: a personalised
        "Ella's Closet" over a campus feed named something she had not
        chosen, and a pill that looked like a filter chip rather than
        the two halves of the feed.

        THE UNDERLINE IS MERLOT, NOT THE BUTTER IN THE SCREENSHOT.
        Butter is a background colour in our tokens — 1.19:1 on cream —
        so a two-point line of it is very nearly invisible, which
        defeats the one thing an active-tab underline is for. Zack's
        own fallback, and the roles already say merlot for something
        that belongs to neither lender nor renter.
      */}
      <View style={styles.tabs}>
        {(
          [
            ['campus', 'All Campus'],
            ['following', 'Following'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            style={styles.tab}
          >
            <Text variant="label" tone={tab === value ? 'heading' : 'muted'}>
              {label}
            </Text>
            {/* Always drawn, only the colour changes, so switching tab
                does not move the row by two points. */}
            <View style={[styles.underline, tab === value && styles.underlineOn]} />
          </Pressable>
        ))}
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
              ? () => gate.run('postLook', () => void startLook(draft, router.push))
              : () => router.push('/(tabs)/discover')
          }
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(post) => post.id}
          /*
            The suggestions row lives inside renderItem, which closes
            over `closets`. FlatList only re-renders a row when `data`
            changes, so without this the row at index 8 keeps whatever
            it rendered before the fetch came back — which is nothing,
            every time.
          */
          extraData={suggested.closets}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
          onScroll={tour.visible ? tourTargets.measureTargets : undefined}
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
          renderItem={({ item, index }) => (
            <>
              {/*
                After the eighth post, and once only.
                
                Rendered BEFORE the post rather than after, so the row
                lands at a card boundary she has just scrolled to
                rather than interrupting one she is reading. Once only
                because a second row of the same faces further down
                reads as a bug, not a suggestion.
              */}
              {index === suggestionsIndex(visible.length) && suggested.closets.length > 0 ? (
                <SuggestedClosets
                  closets={suggested.closets}
                  onFollow={(uid) => void suggested.follow(uid)}
                  onDismiss={(uid) => void suggested.dismiss(uid)}
                  onOpen={(username) => router.push(`/u/${username}`)}
                />
              ) : null}
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
                /*
                  Straight into the dressing room with this look's
                  pieces. Try-On sends her to Choose a body first if
                  she has no photo yet, and brings her back itself —
                  one place decides that rather than every caller.
                */
                onTryOnLook={(listingIds) =>
                  router.push({
                    pathname: '/try-on',
                    params: { listings: listingIds.join(',') },
                  })
                }
                onEdit={
                  item.authorUid === profile?.uid
                    ? () => router.push({ pathname: '/edit-post', params: { id: item.id } })
                    : undefined
                }
              />
            </>
          )}
        />
      )}

      <ProfileGateSheet gate={gate} />
      <Walkthrough visible={tour.visible} onDone={() => void tour.done()} />
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  underline: {
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
  },
  underlineOn: { backgroundColor: color.role.shared.background },
  campusRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  // A cream track with a merlot pill sliding in it.
  // Compact, so the headline beside it does not have to shrink to fit.
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingTop: spacing.sm,
    // Clears the raised + button, which floats over the last card.
    paddingBottom: controls.buttonHeight + controls.minTapTarget + spacing.xxl,
    // White, not cream. The posts are edge to edge, so there are no
    // sides for a band to show through — cream here would only ever be
    // a strip above the first post and below the last.
    backgroundColor: color.surface.page,
  },
  footer: { paddingVertical: spacing.lg },
  end: { textAlign: 'center', paddingVertical: spacing.lg },
});
