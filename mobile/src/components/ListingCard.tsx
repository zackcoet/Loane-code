/**
 * One garment in the Discover grid.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import {
  fonts,
  fontFamilyFor,
  type Listing,
  color,
  controls,
  formatCentsShort,
  radius,
  spacing,
  type,
} from '@loane/shared';
import { isTryOnEligible } from '../hooks/useTryOn';
import { Icon } from './Icon';
import { Text } from './Text';
import { useIsSaved } from '../hooks/useSaved';
import { ThumbImage } from './ThumbImage';

interface Props {
  listing: Listing;
  /** Card width, worked out by the grid. */
  width: number;
  onPress?: (listingId: string) => void;
  onPressOwner?: (username: string) => void;
  /** Hides the heart, e.g. on her own closet. */
  hideSave?: boolean;
  /**
   * Shows a small "Try on" under the card. Passed only where it makes
   * sense — Saved — rather than everywhere a card appears, because a
   * grid of browse results with a button on every tile is noise.
   */
  onTryOn?: (listingId: string) => void;
  /** Press and hold: a big preview (PeekPreview). Off unless passed. */
  onLongPress?: (listing: Listing) => void;
}

export function ListingCard({
  listing,
  width,
  onPress,
  onPressOwner,
  hideSave,
  onTryOn,
  onLongPress,
}: Props) {
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
      accessibilityHint={onLongPress ? 'Press and hold to preview' : undefined}
      onPress={() => onPress?.(listing.id)}
      onLongPress={onLongPress ? () => onLongPress(listing) : undefined}
    >
      <View>
        {listing.coverUrl ? (
          <ThumbImage uri={listing.coverUrl} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}
        {/* A lender can see at a glance which of her pieces are ready,
            and a renter can see which ones she can try on before
            tapping in. */}
        {isTryOnEligible(listing) ? (
          <View style={styles.readyBadge}>
            <Icon name="sparkles" size={11} tint={color.role.shared.label} />
            <Text style={styles.readyLabel}>Try-on</Text>
          </View>
        ) : null}

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

      {/* Only when the piece can actually be tried on. A button that
          explains why it does nothing belongs in the try-on row, where
          she is choosing between pieces — not on a card in a grid. */}
      {onTryOn && isTryOnEligible(listing) ? (
        <Pressable
          onPress={() => onTryOn(listing.id)}
          accessibilityRole="button"
          accessibilityLabel={`Try on ${listing.name}`}
          style={({ pressed }) => [styles.tryOn, pressed && styles.tryOnPressed]}
        >
          <Icon name="sparkles" size={13} tint={color.role.shared.background} />
          <Text style={styles.tryOnLabel}>Try on</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  readyBadge: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: color.role.shared.background,
  },
  readyLabel: {
    fontFamily: fontFamilyFor('600'),
    fontSize: type.caption.size,
    color: color.role.shared.label,
  },
  tryOn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    height: controls.minTapTarget - 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.role.shared.border,
  },
  tryOnPressed: { opacity: 0.6 },
  tryOnLabel: {
    fontFamily: fontFamilyFor('600'),
    fontSize: type.caption.size,
    color: color.role.shared.background,
  },
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
    fontFamily: fonts.body,
    marginTop: spacing.sm,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  // Merlot type, not a filled tag. A price is information rather than
  // an action, and a tag as loud as the Loane It button makes neither
  // one the thing to tap.
  priceTag: { alignSelf: 'flex-start' },
  price: {
    fontFamily: fontFamilyFor('600'),
    fontSize: type.bodySmall.size,
    fontWeight: '600',
    color: color.text.heading,
  },
  size: {
    fontFamily: fontFamilyFor('500'),
    marginLeft: spacing.sm,
    fontSize: type.caption.size,
    letterSpacing: type.caption.letterSpacing,
    color: color.text.muted,
  },
  owner: {
    fontFamily: fontFamilyFor('500'),
    fontSize: type.caption.size,
    color: color.text.muted,
    marginTop: 2,
  },
});
