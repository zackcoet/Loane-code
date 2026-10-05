/**
 * My Wishlist — Items and Looks.
 *
 * Two tabs rather than one mixed grid: a saved garment is something you
 * might rent, a saved look is inspiration. They are different things you
 * do different things with, so mixing them makes both harder to find.
 *
 * Both read live rather than from a copy taken at save time, so a piece
 * that has since been paused shows its real state.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { color, spacing } from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { ListingCard } from '../src/components/ListingCard';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useWishlist } from '../src/hooks/useSaved';
import { useSavedPosts } from '../src/hooks/usePostEngagement';

const GRID_COLUMNS = 2;

export default function MyWishlist() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<'items' | 'looks'>('items');

  const items = useWishlist();
  const looks = useSavedPosts();

  const cardWidth = (width - spacing.md * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

  // A saved piece can be paused, sold or taken down after she saved it.
  const available = items.listings.filter((l) => l.status === 'active');
  const unavailable = items.listings.filter((l) => l.status !== 'active');

  return (
    <Screen flush>
      <Header title="My Wishlist" onBack={() => router.back()} />

      <View style={styles.tabRow}>
        {(
          [
            ['items', `Items${items.listings.length ? ` · ${items.listings.length}` : ''}`],
            ['looks', `Looks${looks.posts.length ? ` · ${looks.posts.length}` : ''}`],
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

      {tab === 'items' ? (
        items.loading ? (
          <Loading />
        ) : items.listings.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Tap the heart on a piece and it waits for you here."
            actionLabel="Browse closets"
            onAction={() => router.replace('/(tabs)/discover')}
          />
        ) : (
          <FlatList
            data={[...available, ...unavailable]}
            keyExtractor={(listing) => listing.id}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              unavailable.length > 0 ? (
                <Text variant="caption" tone="muted" style={styles.note}>
                  {unavailable.length} no longer available
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={item.status === 'active' ? undefined : styles.dimmed}>
                <ListingCard
                  listing={item}
                  width={cardWidth}
                  onPressOwner={(username) => router.push(`/u/${username}`)}
                  onPress={(listingId) =>
                    router.push({ pathname: '/listing/[id]', params: { id: listingId } })
                  }
                />
              </View>
            )}
          />
        )
      ) : looks.loading ? (
        <Loading />
      ) : looks.posts.length === 0 ? (
        <EmptyState
          title="No looks saved yet"
          body="Tap the star on a look and it waits for you here."
          actionLabel="Browse the feed"
          onAction={() => router.replace('/(tabs)/feed')}
        />
      ) : (
        <FlatList
          data={looks.posts}
          keyExtractor={(post) => post.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.caption || 'Open look'}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
              style={[styles.lookTile, { width: cardWidth }]}
            >
              {item.photos[0] ? (
                <Image
                  source={{ uri: item.photos[0].url }}
                  style={styles.lookImage}
                  resizeMode="cover"
                />
              ) : null}
              {item.taggedListings.length > 0 ? (
                <View style={styles.lookBadge}>
                  <Text variant="caption" tone="inverse">
                    {item.taggedListings.length} tagged
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </Screen>
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
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: color.border.accent },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  gridRow: { gap: spacing.md },
  note: { marginBottom: spacing.sm },
  dimmed: { opacity: 0.45 },
  lookTile: {
    aspectRatio: 0.8,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
    overflow: 'hidden',
  },
  lookImage: { width: '100%', height: '100%' },
  lookBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: color.surface.inverse,
    opacity: 0.85,
  },
});
