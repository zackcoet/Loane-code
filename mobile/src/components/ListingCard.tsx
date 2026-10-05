/**
 * One garment in the Discover grid.
 */

import { Image, Pressable, StyleSheet, View } from 'react-native';
import { type Listing, color, formatCentsShort, radius, spacing, type } from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';
import { useIsSaved } from '../hooks/useSaved';

interface Props {
  listing: Listing;
  /** Card width, worked out by the grid. */
  width: number;
  onPress?: (listingId: string) => void;
  onPressOwner?: (username: string) => void;
  /** Hides the heart, e.g. on her own closet. */
  hideSave?: boolean;
}

export function ListingCard({ listing, width, onPress, onPressOwner, hideSave }: Props) {
  const { saved, toggle } = useIsSaved(listing.id);
  const price =
    listing.pricing.threeDayCents != null
      ? formatCentsShort(listing.pricing.threeDayCents)
      : listing.salePriceCents != null
        ? formatCentsShort(listing.salePriceCents)
        : null;

  return (
    <Pressable
      style={[styles.card, { width }]}
      accessibilityRole="button"
      accessibilityLabel={listing.name}
      onPress={() => onPress?.(listing.id)}
    >
      <View>
        {listing.coverUrl ? (
          <Image source={{ uri: listing.coverUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}
        {hideSave ? null : (
          <Pressable
            onPress={() => void toggle('discover')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            style={styles.heart}
          >
            <Icon name={saved ? 'heart' : 'heart-outline'} size={16} tint={color.text.inverse} />
          </Pressable>
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {listing.name}
      </Text>
      <View style={styles.metaRow}>
        {price ? (
          <View style={styles.priceTag}>
            <Text style={styles.price}>{price}</Text>
          </View>
        ) : null}
        {listing.size ? <Text style={styles.size}>{listing.size}</Text> : null}
      </View>
      <Text
        style={styles.owner}
        numberOfLines={1}
        onPress={() => onPressOwner?.(listing.owner.username)}
        suppressHighlighting
      >
        @{listing.owner.username}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  photo: { width: '100%', aspectRatio: 0.75, backgroundColor: color.surface.muted },
  photoPlaceholder: { borderWidth: 1, borderColor: color.border.default },
  heart: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.inverse,
    opacity: 0.85,
  },
  name: {
    marginTop: spacing.sm,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  priceTag: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    backgroundColor: color.accent.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  price: { fontSize: type.caption.size, fontWeight: '600', color: color.accent.label },
  size: {
    marginLeft: spacing.sm,
    fontSize: type.caption.size,
    letterSpacing: type.caption.letterSpacing,
    color: color.text.muted,
  },
  owner: { fontSize: type.caption.size, color: color.text.muted, marginTop: 2 },
});
