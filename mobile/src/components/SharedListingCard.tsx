/**
 * A piece somebody sent into a chat.
 *
 * Renders the snapshot stamped into the message when it was sent, so
 * it shows instantly and survives the listing coming down. Tapping it
 * opens the live listing, which is where the real price and dates are.
 *
 * Sets its own colours rather than taking the bubble's, for the same
 * reason as the shared-look card: inheriting the dark bubble's inverse
 * text on a pale panel came out white on near-white.
 */

import { Image, Pressable, StyleSheet, View } from 'react-native';
import {
  WORDS,
  color,
  fontFamilyFor,
  formatCentsShort,
  radius,
  spacing,
  type,
  type SharedListing,
} from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';

/** "Loane It from $25 · Own It $90", or whichever half applies. */
export function sharedListingPrice(item: SharedListing): string | null {
  const parts: string[] = [];
  if (item.rentFromCents != null) {
    parts.push(`${WORDS.rent} from ${formatCentsShort(item.rentFromCents)}`);
  }
  if (item.salePriceCents != null) {
    parts.push(`${WORDS.buy} ${formatCentsShort(item.salePriceCents)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function SharedListingCard({ item, onPress }: { item: SharedListing; onPress: () => void }) {
  const price = sharedListingPrice(item);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} from @${item.ownerUsername}'s closet${price ? `, ${price}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.photo} />
      )}
      <View style={styles.text}>
        <Text variant="caption" tone="muted">
          @{item.ownerUsername}&apos;s closet
        </Text>
        <Text variant="bodySmall" tone="primary" numberOfLines={2}>
          {item.name || 'A piece'}
        </Text>
        {price ? <Text style={styles.price}>{price}</Text> : null}
        <View style={styles.cta}>
          <Text variant="caption" tone="muted" uppercase={false}>
            Tap to see dates
          </Text>
          <Icon name="chevron-forward" size={14} tint={color.icon.muted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 232,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface.page,
    borderWidth: 1,
    borderColor: color.border.default,
  },
  pressed: { opacity: 0.8 },
  photo: { width: '100%', height: 232, backgroundColor: color.surface.muted },
  text: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 3 },
  // Merlot type, not a filled tag — a price is information, not the
  // thing to tap. Same rule as ListingCard.
  price: {
    fontFamily: fontFamilyFor('600'),
    fontSize: type.bodySmall.size,
    fontWeight: '600',
    color: color.text.heading,
  },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
});
