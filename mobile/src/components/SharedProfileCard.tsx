/**
 * Someone's profile sent into a chat — "you have to see her closet".
 *
 * Renders the snapshot stamped into the message when it was sent, so it
 * shows instantly. Tapping it opens the live profile, which is where her
 * real closet is. Sets its own colours for the same reason as the
 * shared-piece card: a card is a card whoever sent it.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { color, radius, spacing, type SharedProfile } from '@loane/shared';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Text } from './Text';

/** "12 pieces in closet" — or nothing for an empty closet. */
export function closetSizeLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? '1 piece in closet' : `${count} pieces in closet`;
}

export function SharedProfileCard({ item, onPress }: { item: SharedProfile; onPress: () => void }) {
  const closet = closetSizeLine(item.listingCount);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open @${item.username}'s profile${closet ? `, ${closet}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Avatar url={item.photoUrl} name={item.displayName} size={64} />
      <View style={styles.text}>
        <Text variant="bodySmall" tone="primary" numberOfLines={1}>
          {item.displayName || `@${item.username}`}
        </Text>
        <Text variant="caption" tone="muted" uppercase={false} numberOfLines={1}>
          @{item.username}
        </Text>
        {closet ? (
          <Text variant="caption" tone="muted" uppercase={false}>
            {closet}
          </Text>
        ) : null}
      </View>
      <View style={styles.cta}>
        <Text variant="caption" tone="muted" uppercase={false}>
          View profile
        </Text>
        <Icon name="chevron-forward" size={14} tint={color.icon.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 232,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: color.surface.page,
    borderWidth: 1,
    borderColor: color.border.default,
  },
  pressed: { opacity: 0.8 },
  text: { alignItems: 'center', gap: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
