/**
 * The Posts / Closet / Reviews tabs and their contents.
 *
 * Shared between her own profile and another student's, so both show the
 * same thing. Posts and Closet read real data; Reviews is an honest empty
 * state until reviews exist in Phase 6.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  color,
  spacing,
  type,
} from '@loane/shared';
import { EmptyState } from './EmptyState';
import { ListingCard } from './ListingCard';
import { useUserListings, useUserPosts } from '../hooks/useProfile';

const TABS = ['posts', 'closet', 'reviews'] as const;
type ProfileTab = (typeof TABS)[number];

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

  const cardWidth = (width - spacing.md * 3) / 2;

  return (
    <View style={styles.wrapper}>
      <View style={styles.tabRow}>
        {TABS.map((value) => (
          <Text
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}
          >
            {value}
          </Text>
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
          // TODO-PHASE3: a real photo grid once posts carry real images.
          <View style={styles.postGrid}>
            {posts.items.map((post) => (
              <View key={post.id} style={[styles.postTile, { width: cardWidth }]}>
                <Text style={styles.postCaption} numberOfLines={3}>
                  {post.caption}
                </Text>
                {post.taggedListings.length > 0 ? (
                  <Text style={styles.postTagged}>
                    {post.taggedListings.length} tagged
                  </Text>
                ) : null}
              </View>
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
                onPress={(listingId) =>
                  router.push({ pathname: '/listing/[id]', params: { id: listingId } })
                }
              />
            ))}
          </View>
        )
      ) : (
        // TODO-PHASE6: reviews are written after a completed rental.
        <EmptyState
          title="No reviews yet"
          body="Reviews appear after a completed rental."
        />
      )}
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
  tab: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.md,
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.muted,
  },
  tabActive: {
    color: color.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: color.border.inverse,
  },
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
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  postCaption: {
    fontSize: type.bodySmall.size,
    lineHeight: type.bodySmall.lineHeight,
    color: color.text.primary,
  },
  postTagged: {
    fontSize: type.caption.size,
    letterSpacing: type.caption.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.muted,
  },
});
