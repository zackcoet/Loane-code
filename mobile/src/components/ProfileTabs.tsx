/**
 * The tabs on a profile and their contents.
 *
 * Everyone sees Posts, Closet and Reviews. On her OWN profile there are
 * two more — Saved and Liked — which is where Instagram puts them and
 * where people look for them. They are private to her: what she saved is
 * a shopping list, and a public list of everything she liked is a
 * different and much more exposing thing than a like on a post.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  type Review,
  color,
  spacing,
} from '@loane/shared';
import { EmptyState } from './EmptyState';
import { ListingCard } from './ListingCard';
import { useUserListings, useUserPosts } from '../hooks/useProfile';
import { useReviews } from '../hooks/useReviews';
import { useSavedPosts } from '../hooks/usePostEngagement';
import { useLikedPosts } from '../hooks/useLikedPosts';
import { ReportSheet } from './ReportSheet';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Text } from './Text';

const PUBLIC_TABS = ['posts', 'closet', 'reviews'] as const;
const MY_TABS = ['posts', 'closet', 'saved', 'liked', 'reviews'] as const;
type ProfileTab = (typeof MY_TABS)[number];

interface Props {
  uid: string;
  /** Changes the empty-state wording between "you" and "she". */
  isMe: boolean;
}

export function ProfileTabs({ uid, isMe }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<ProfileTab>('posts');
  const { width } = useWindowDimensions();

  const posts = useUserPosts(uid);
  const listings = useUserListings(uid);
  const reviews = useReviews(uid);
  // Only ever her own, and only fetched when she is looking at her own
  // profile — these hooks read by the signed-in uid, not by `uid`.
  const saved = useSavedPosts();
  const liked = useLikedPosts();
  const [reporting, setReporting] = useState<Review | null>(null);

  const cardWidth = (width - spacing.md * 3) / 2;
  const tabs = isMe ? MY_TABS : PUBLIC_TABS;

  /** Saved and Liked are the same grid of looks, twice. */
  const lookGrid = (items: typeof posts.items) => (
    <View style={styles.postGrid}>
      {items.map((post) => (
        <Pressable
          key={post.id}
          accessibilityRole="button"
          accessibilityLabel={post.caption || `Look by @${post.author.username}`}
          onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
          style={[styles.postTile, { width: cardWidth }]}
        >
          {post.photos[0] ? (
            <Image
              source={{ uri: post.photos[0].url }}
              style={styles.postImage}
              resizeMode="cover"
            />
          ) : null}
          {post.taggedListings.length > 0 ? (
            <View style={styles.postBadge}>
              <Text variant="caption" tone="inverse">
                {post.taggedListings.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.tabRow}>
        {tabs.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
          >
            <Text variant="label" tone={tab === value ? 'primary' : 'muted'}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'posts' ? (
        posts.loading ? (
          <Loading />
        ) : posts.items.length === 0 ? (
          <EmptyState
            title="No posts yet"
            body={
              isMe
                ? 'Looks you post will show up here.'
                : 'She has not posted a look yet.'
            }
          />
        ) : (
          <View style={styles.postGrid}>
            {posts.items.map((post) => (
              <Pressable
                key={post.id}
                accessibilityRole="button"
                accessibilityLabel={post.caption || 'Open look'}
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
                style={[styles.postTile, { width: cardWidth }]}
              >
                {post.photos[0] ? (
                  <Image
                    source={{ uri: post.photos[0].url }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                ) : null}
                {post.taggedListings.length > 0 ? (
                  <View style={styles.postBadge}>
                    <Text variant="caption" tone="inverse">
                      {post.taggedListings.length}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )
      ) : tab === 'closet' ? (
        listings.loading ? (
          <Loading />
        ) : listings.items.length === 0 ? (
          <EmptyState
            title="Nothing in the closet yet"
            body={
              isMe
                ? 'Pieces you list to rent or sell will live here.'
                : 'She has not listed anything yet.'
            }
          />
        ) : (
          <View style={styles.grid}>
            {listings.items.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                width={cardWidth}
                hideSave={isMe}
                onPress={(listingId) =>
                  router.push({ pathname: '/listing/[id]', params: { id: listingId } })
                }
              />
            ))}
          </View>
        )
      ) : tab === 'saved' ? (
        saved.loading ? (
          <Loading />
        ) : saved.posts.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Tap the bookmark on a look and it collects here."
          />
        ) : (
          lookGrid(saved.posts)
        )
      ) : tab === 'liked' ? (
        liked.loading ? (
          <Loading />
        ) : liked.posts.length === 0 ? (
          <EmptyState
            title="Nothing liked yet"
            body="Double tap a look you love and it collects here."
          />
        ) : (
          lookGrid(liked.posts)
        )
      ) : reviews.loading ? (
        <Loading />
      ) : reviews.reviews.length === 0 ? (
        <EmptyState title="No reviews yet" body="Reviews appear after a completed rental." />
      ) : (
        <View style={styles.reviewList}>
          {reviews.reviews.map((review) => (
            <View key={review.id} style={styles.review}>
              <View style={styles.reviewHead}>
                <Avatar url={review.author.photoUrl} name={review.author.displayName} size={32} />
                <View style={styles.reviewWho}>
                  <Text variant="bodySmall">@{review.author.username}</Text>
                  <Text variant="caption" tone="muted">
                    {review.authorRole === 'lender' ? 'lent to her' : 'rented from her'}
                  </Text>
                </View>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Icon
                      key={n}
                      name={n <= review.rating ? 'star' : 'star-outline'}
                      size={12}
                      tint={color.text.primary}
                    />
                  ))}
                </View>
              </View>
              {review.body ? (
                <Text variant="bodySmall" style={styles.reviewBody}>
                  {review.body}
                </Text>
              ) : null}
              {/* A nasty review used to leave blocking as the only
                  option. Reporting one is its own thing. */}
              <Text
                variant="caption"
                tone="muted"
                accessibilityRole="button"
                onPress={() => setReporting(review)}
                style={styles.reviewReport}
              >
                Report this review
              </Text>
            </View>
          ))}
        </View>
      )}

      <ReportSheet
        visible={reporting !== null}
        targetType="user"
        targetId={reporting?.id ?? ''}
        targetUid={reporting?.authorUid}
        targetLabel={`a review by @${reporting?.author.username ?? ''}`}
        onClose={() => setReporting(null)}
      />
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={color.icon.default} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, marginTop: spacing.lg },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.inverse },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
  },
  postGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
  },
  postTile: {
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
    overflow: 'hidden',
  },
  postImage: { width: '100%', height: '100%' },
  postBadge: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: color.surface.inverse,
    alignItems: 'center',
  },
  reviewList: { padding: spacing.md, gap: spacing.md },
  review: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
    paddingBottom: spacing.md,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center' },
  reviewWho: { flex: 1, marginLeft: spacing.sm },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewBody: { marginTop: spacing.sm },
  reviewReport: { marginTop: spacing.sm, textDecorationLine: 'underline' },

});
