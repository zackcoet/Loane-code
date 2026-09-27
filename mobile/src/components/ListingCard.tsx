/**
 * One garment in the Discover grid.
 */

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  type Listing,
  color,
  formatCentsShort,
  spacing,
  type,
} from '@loane/shared';

interface Props {
  listing: Listing;
  /** Card width, worked out by the grid. */
  width: number;
  onPress?: (listingId: string) => void;
  onPressOwner?: (username: string) => void;
}

export function ListingCard({ listing, width, onPress, onPressOwner }: Props) {
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
      {listing.coverUrl ? (
        <Image source={{ uri: listing.coverUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]} />
      )}

      <Text style={styles.name} numberOfLines={1}>
        {listing.name}
      </Text>
      <View style={styles.metaRow}>
        {price ? <Text style={styles.price}>{price}</Text> : null}
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
  name: {
    marginTop: spacing.sm,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  price: { fontSize: type.bodySmall.size, fontWeight: '600', color: color.text.primary },
  size: {
    marginLeft: spacing.sm,
    fontSize: type.caption.size,
    letterSpacing: type.caption.letterSpacing,
    color: color.text.muted,
  },
  owner: { fontSize: type.caption.size, color: color.text.muted, marginTop: 2 },
});
