/**
 * My Listings — everything in her own closet, including the pieces
 * nobody else can see.
 *
 * This is the one place that shows paused, draft and removed listings, so
 * she can tell the difference between "hidden" and "gone" and switch a
 * piece back on.
 */

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
import {
  color,
  controls,
  formatCentsShort,
  radius,
  spacing,
  type Listing,
  type ListingStatus,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useUserListings } from '../src/hooks/useProfile';

/** What each status means to her, in her words rather than ours. */
const STATUS_LABEL: Record<ListingStatus, string | null> = {
  active: null,
  paused: 'Hidden',
  draft: 'Draft',
  removed: 'Removed',
  sold: 'Sold',
  suspended: 'Taken down',
};

export default function MyListings() {
  const router = useRouter();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const { items, loading } = useUserListings(profile?.uid, true);

  const thumb = Math.min(96, width * 0.24);

  return (
    <Screen flush>
      <Header title="My Listings" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing listed yet"
          body="Add a piece and it shows up here, and on your campus."
          actionLabel="Add to closet"
          onAction={() => router.push('/add-to-closet')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(listing) => listing.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Button
              label="Add another piece"
              variant="outline"
              onPress={() => router.push('/add-to-closet')}
              style={styles.addButton}
            />
          }
          renderItem={({ item }) => <Row listing={item} thumb={thumb} />}
        />
      )}
    </Screen>
  );
}

function Row({ listing, thumb }: { listing: Listing; thumb: number }) {
  const router = useRouter();
  const badge = STATUS_LABEL[listing.status];
  const dimmed = listing.status === 'removed' || listing.status === 'suspended';

  const price =
    listing.pricing.threeDayCents != null
      ? `${formatCentsShort(listing.pricing.threeDayCents)} · 3 days`
      : listing.salePriceCents != null
        ? `${formatCentsShort(listing.salePriceCents)} · for sale`
        : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${listing.name}`}
      onPress={() => router.push({ pathname: '/edit-listing', params: { id: listing.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View
        style={[
          styles.thumb,
          { width: thumb, height: thumb },
          dimmed && styles.dimmed,
          listing.coverUrl ? null : styles.thumbEmpty,
        ]}
      >
        {listing.coverUrl ? (
          <Image source={{ uri: listing.coverUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text variant="caption" tone="muted">
            No photo
          </Text>
        )}
      </View>

      <View style={styles.rowText}>
        <Text numberOfLines={1} tone={dimmed ? 'muted' : 'primary'}>
          {listing.name}
        </Text>
        {price ? (
          <Text variant="bodySmall" tone="secondary" style={styles.price}>
            {price}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted" style={styles.meta}>
          {listing.stats.viewCount} views · {listing.stats.saveCount} saved
        </Text>
      </View>

      {badge ? (
        <View style={styles.badge}>
          <Text variant="caption" tone="secondary">
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  addButton: { marginBottom: spacing.lg, height: controls.buttonHeightSmall },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
    minHeight: controls.minTapTarget,
  },
  rowPressed: { backgroundColor: color.surface.muted },
  thumb: {
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
    overflow: 'hidden',
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  dimmed: { opacity: 0.45 },
  rowText: { flex: 1, marginLeft: spacing.md },
  price: { marginTop: 2 },
  meta: { marginTop: 4 },
  badge: {
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginLeft: spacing.sm,
  },
});
