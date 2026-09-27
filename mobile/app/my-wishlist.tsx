/**
 * My Wishlist — everything she has saved, newest first.
 *
 * Listings are read live rather than copied onto the save row, so a piece
 * that has since been paused, sold or removed shows its real state instead
 * of a stale snapshot. That matters: the whole point of a wishlist is
 * coming back to it later.
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { color, spacing } from '@loane/shared';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { ListingCard } from '../src/components/ListingCard';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useWishlist } from '../src/hooks/useSaved';

const GRID_COLUMNS = 2;

export default function MyWishlist() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { listings, loading } = useWishlist();

  const cardWidth = (width - spacing.md * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

  // A saved piece can be paused, sold or taken down after she saved it.
  const available = listings.filter((l) => l.status === 'active');
  const unavailable = listings.filter((l) => l.status !== 'active');

  return (
    <Screen flush>
      <Header title="My Wishlist" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : listings.length === 0 ? (
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
            <Text variant="caption" tone="muted" style={styles.count}>
              {listings.length} saved
              {unavailable.length > 0 ? ` · ${unavailable.length} no longer available` : ''}
            </Text>
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  gridRow: { gap: spacing.md },
  count: { marginBottom: spacing.sm },
  dimmed: { opacity: 0.45 },
});
