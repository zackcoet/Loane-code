/**
 * Press and hold a grid tile to see it big, without leaving the grid.
 *
 * Instagram's "peek". A three-across closet tile is a thumbnail the size
 * of a stamp; holding it shows the full photo, who it belongs to and
 * what it costs, so she can decide whether it is worth opening.
 *
 * WHY IT STAYS OPEN UNTIL A TAP rather than closing when her finger
 * lifts, as Instagram's does: on iOS, a Modal appearing under a finger
 * that is still down can cancel that touch, which would close the
 * preview the instant it opened. Tap-to-close works the same whether or
 * not that happens. Tap the photo to open it; tap anywhere else to close.
 *
 * Opening a preview logs nothing: it is not a view of the page, and
 * counting it as one would inflate the numbers the feed ranking reads.
 */

import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { color, radius, spacing, type Listing, type Post, formatCentsShort } from '@loane/shared';
import { Avatar } from './Avatar';
import { Text } from './Text';

export type PeekItem = { kind: 'post'; post: Post } | { kind: 'listing'; listing: Listing };

interface Props {
  item: PeekItem | null;
  onClose: () => void;
  /** Tap on the preview: open the look or piece properly. */
  onOpen: (item: PeekItem) => void;
}

/** Same words the closet tile uses, so the price never reads two ways. */
function priceLine(listing: Listing): string | null {
  const rent = listing.pricing?.threeDayCents;
  if (rent != null) return `${formatCentsShort(rent)} for 3 days`;
  if (listing.salePriceCents != null) return `${formatCentsShort(listing.salePriceCents)} to own`;
  return null;
}

export function PeekPreview({ item, onClose, onOpen }: Props) {
  if (!item) return null;

  const isPost = item.kind === 'post';
  // The full photo, not the 480px thumbnail: this is the one time it is big.
  const photo = isPost ? item.post.photos[0]?.url : item.listing.coverUrl;
  const owner = isPost ? item.post.author : item.listing.owner;
  const title = isPost ? item.post.caption : item.listing.name;
  const detail = isPost
    ? item.post.taggedListings.length > 0
      ? `${item.post.taggedListings.length} tagged ${item.post.taggedListings.length === 1 ? 'piece' : 'pieces'}`
      : null
    : priceLine(item.listing);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close preview"
      >
        <Pressable
          onPress={() => onOpen(item)}
          accessibilityRole="button"
          accessibilityLabel={isPost ? 'Open this look' : `Open ${item.listing.name}`}
          style={styles.card}
        >
          <View style={styles.header}>
            <Avatar url={owner.photoUrl} name={owner.displayName} size={32} />
            <Text variant="bodySmall" uppercase={false} numberOfLines={1} style={styles.flex}>
              @{owner.username}
            </Text>
          </View>
          <View style={[styles.photo, { aspectRatio: isPost ? 0.8 : 0.85 }]}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.image} resizeMode="cover" />
            ) : null}
          </View>
          {title || detail ? (
            <View style={styles.footer}>
              {title ? (
                <Text variant="bodySmall" uppercase={false} numberOfLines={2}>
                  {title}
                </Text>
              ) : null}
              {detail ? (
                <Text variant="caption" tone={isPost ? 'muted' : 'primary'}>
                  {detail}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: color.scrim.behindPanel,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: color.surface.raised,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  flex: { flex: 1 },
  photo: { width: '100%', backgroundColor: color.surface.muted },
  image: { width: '100%', height: '100%' },
  footer: { padding: spacing.md, gap: spacing.xs },
});
