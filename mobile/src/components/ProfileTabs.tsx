/**
 * The Posts / Closet / Reviews tabs and their contents.
 *
 * Shared between her own profile and another student's, so both show the
 * same thing. Posts and Closet read real data; Reviews is an honest empty
 * state until reviews exist in Phase 6.
 */

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, spacing, typography } from '@loane/shared';
import { EmptyState } from './EmptyState';
import { ListingCard } from './ListingCard';
import { useUserListings, useUserPosts } from '../hooks/useProfile';

const TABS = ['posts', 'closet', 'reviews'] as const;
type ProfileTab = (typeof TABS)[number];

interface Props {
  uid: string;
  /** Changes the empty-state wording between "you" and "she". */
  isMe: boolean;
  onPressListing?: (listingId: string) => void;
}

export function ProfileTabs({ uid, isMe, onPressListing }: Props) {
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
                onPress={onPressListing}
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
      <ActivityIndicator color={colors.black} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, marginTop: spacing.lg },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.md,
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  tabActive: {
    color: colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
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
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  postCaption: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textPrimary,
  },
  postTagged: {
    fontSize: typography.caption.size,
    letterSpacing: typography.caption.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
