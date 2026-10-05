/**
 * The two tabs on a profile: Closet and Posts.
 *
 * CLOSET IS FIRST AND OPEN BY DEFAULT, on purpose. Loane is a rental
 * app — the merchandise leads and the looks support it. A profile that
 * opened on Posts made her closet something you had to go and find.
 *
 * Three across, like Instagram, because a rail of thumbnails reads as a
 * collection where two big cards read as a list of two things. Closet
 * tiles carry the rent price, so the grid answers "what does this cost"
 * without a single tap.
 *
 * Saved and Liked used to live here as tabs. They are hers, not a
 * visitor's, and they are not merchandise — they moved to the side
 * panel. Reviews moved to the rating in the header, which is where
 * somebody deciding whether to trust her is already looking.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { usePostDraft } from '../post/postDraft';
import { startLook } from '../post/startLook';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { color, formatCentsShort, spacing, type Listing, type Post } from '@loane/shared';
import { EmptyState } from './EmptyState';
import { Text } from './Text';
import { useUserListings, useUserPosts } from '../hooks/useProfile';

const TABS = ['closet', 'posts'] as const;
type ProfileTab = (typeof TABS)[number];

const COLUMNS = 3;
/** The hairline between tiles. Instagram uses a gap this small. */
const GUTTER = 2;

interface Props {
  uid: string;
  /** Changes the empty-state wording between "you" and "she". */
  isMe: boolean;
}

export function ProfileTabs({ uid, isMe }: Props) {
  const router = useRouter();
  const draft = usePostDraft();
  const [tab, setTab] = useState<ProfileTab>('closet');
  const { width } = useWindowDimensions();

  const posts = useUserPosts(uid);
  const listings = useUserListings(uid);

  const tileWidth = (width - GUTTER * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={styles.wrapper}>
      <View style={styles.tabRow}>
        {TABS.map((value) => (
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

      {tab === 'closet' ? (
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
            actionLabel={isMe ? 'Add a piece' : undefined}
            onAction={isMe ? () => router.push('/add-to-closet') : undefined}
          />
        ) : (
          <View style={styles.grid}>
            {listings.items.map((listing) => (
              <ClosetTile
                key={listing.id}
                listing={listing}
                size={tileWidth}
                onPress={() =>
                  router.push({ pathname: '/listing/[id]', params: { id: listing.id } })
                }
              />
            ))}
          </View>
        )
      ) : posts.loading ? (
        <Loading />
      ) : posts.items.length === 0 ? (
        <EmptyState
          title="No posts yet"
          body={isMe ? 'Looks you post will show up here.' : 'She has not posted a look yet.'}
          actionLabel={isMe ? 'Post a look' : undefined}
          onAction={isMe ? () => void startLook(draft, router.push) : undefined}
        />
      ) : (
        <View style={styles.grid}>
          {posts.items.map((post) => (
            <PostTile
              key={post.id}
              post={post}
              size={tileWidth}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** A piece, with what it costs to rent for three days. */
function ClosetTile({
  listing,
  size,
  onPress,
}: {
  listing: Listing;
  size: number;
  onPress: () => void;
}) {
  const rent = listing.pricing?.threeDayCents;
  const buy = listing.salePriceCents;
  const price = rent != null ? formatCentsShort(rent) : buy != null ? formatCentsShort(buy) : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        price
          ? `${listing.name}, ${price}${rent != null ? ' for three days' : ' to buy'}`
          : listing.name
      }
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && styles.pressed]}
    >
      {listing.coverUrl ? (
        <Image source={{ uri: listing.coverUrl }} style={styles.image} resizeMode="cover" />
      ) : null}
      {price ? (
        <View style={styles.price}>
          <Text variant="caption" tone="primary" uppercase={false}>
            {price}
            {rent == null ? ' buy' : ''}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** A look, with how many pieces it tags. */
function PostTile({ post, size, onPress }: { post: Post; size: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={post.caption || `Look by @${post.author.username}`}
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && styles.pressed]}
    >
      {post.photos[0] ? (
        <Image source={{ uri: post.photos[0].url }} style={styles.image} resizeMode="cover" />
      ) : null}
      {post.taggedListings.length > 0 ? (
        <View style={styles.tagged}>
          <Text variant="caption" tone="inverse" uppercase={false}>
            {post.taggedListings.length}
          </Text>
        </View>
      ) : null}
    </Pressable>
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
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GUTTER },
  tile: { backgroundColor: color.surface.muted },
  pressed: { opacity: 0.7 },
  image: { width: '100%', height: '100%' },
  price: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: color.accent.background,
  },
  tagged: {
    position: 'absolute',
    right: 4,
    top: 4,
    minWidth: 18,
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: color.scrim.onPhoto,
  },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
});
