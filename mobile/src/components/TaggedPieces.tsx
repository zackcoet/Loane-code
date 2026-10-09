/**
 * "See tagged pieces" — the panel under a post that turns an outfit
 * into something rentable.
 *
 * This is the whole point of the social feed: somebody sees a look,
 * opens this, and messages the girl who owns the dress. Everything in
 * here is arranged around getting to that message in as few taps as
 * possible.
 *
 * The pieces are read live when the panel opens rather than taken from
 * the snapshot on the post, because size, price and description are
 * exactly what an owner edits. See useListingsByIds.
 */

import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { color, formatCentsShort, radius, spacing, type Listing } from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';
import { useListingsByIds } from '../hooks/useListingsByIds';

interface Props {
  listingIds: string[];
  open: boolean;
  onToggle: () => void;
  onOpenListing: (listingId: string) => void;
  onMessageSeller: (ownerUid: string, listingId: string) => void;
  /** Her own look: there is nobody to message. */
  isMine: boolean;
}

export function TaggedPieces({
  listingIds,
  open,
  onToggle,
  onOpenListing,
  onMessageSeller,
  isMine,
}: Props) {
  const { listings, loading } = useListingsByIds(listingIds, open);
  if (listingIds.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide tagged pieces' : 'See tagged pieces'}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text variant="bodySmall" style={styles.buttonLabel}>
          {open
            ? 'Hide tagged pieces'
            : listingIds.length === 1
              ? 'See tagged piece'
              : `See tagged pieces (${listingIds.length})`}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} tint={color.icon.muted} />
      </Pressable>

      {open ? (
        loading && listings.length === 0 ? (
          <ActivityIndicator color={color.icon.default} style={styles.loading} />
        ) : listings.length === 0 ? (
          <Text variant="caption" tone="muted" style={styles.gone}>
            These pieces are no longer listed.
          </Text>
        ) : (
          <View style={styles.list}>
            {listings.map((listing) => (
              <Piece
                key={listing.id}
                listing={listing}
                isMine={isMine}
                onOpen={() => onOpenListing(listing.id)}
                onMessage={() => onMessageSeller(listing.ownerUid, listing.id)}
              />
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

function Piece({
  listing,
  isMine,
  onOpen,
  onMessage,
}: {
  listing: Listing;
  isMine: boolean;
  onOpen: () => void;
  onMessage: () => void;
}) {
  const size = listing.shoeSize ?? listing.size;
  const rent = listing.pricing?.threeDayCents;
  const buy = listing.salePriceCents;
  // A listing that has come down since the post went up still shows,
  // but says so rather than inviting a message that goes nowhere.
  const available = listing.status === 'active';

  return (
    <View style={styles.piece}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open the listing for ${listing.name}`}
        style={styles.pieceTop}
      >
        {listing.coverUrl ? (
          <Image source={{ uri: listing.coverUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photo} />
        )}

        <View style={styles.pieceText}>
          <Text variant="bodySmall" style={styles.name} numberOfLines={1}>
            {listing.name}
          </Text>
          <Text variant="caption" tone="muted">
            {[size ? `Size ${size}` : null, `@${listing.owner.username}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>

          <View style={styles.prices}>
            {rent != null ? (
              <Text variant="bodySmall" style={styles.price}>
                {formatCentsShort(rent)}
                <Text variant="caption" tone="muted">
                  {' '}
                  / 3 days
                </Text>
              </Text>
            ) : null}
            {buy != null ? (
              <Text variant="bodySmall" style={styles.price}>
                {formatCentsShort(buy)}
                <Text variant="caption" tone="muted">
                  {' '}
                  to buy
                </Text>
              </Text>
            ) : null}
          </View>

          {listing.description ? (
            <Text variant="caption" tone="secondary" numberOfLines={2} style={styles.blurb}>
              {listing.description}
            </Text>
          ) : null}
        </View>

        <Icon name="chevron-forward" size={18} tint={color.icon.muted} />
      </Pressable>

      {!available ? (
        <Text variant="caption" tone="muted" style={styles.gone}>
          Not available right now.
        </Text>
      ) : isMine ? null : (
        <Pressable
          onPress={onMessage}
          accessibilityRole="button"
          accessibilityLabel={`Message @${listing.owner.username} about ${listing.name}`}
          style={({ pressed }) => [styles.message, pressed && styles.pressed]}
        >
          <Icon name="chatbubble-outline" size={16} tint={color.icon.inverse} />
          <Text variant="caption" tone="inverse">
            Message seller
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: color.surface.muted,
  },
  buttonLabel: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
  loading: { paddingVertical: spacing.md },
  list: { gap: spacing.sm, paddingTop: spacing.sm },
  gone: { paddingTop: spacing.xs },
  piece: {
    borderWidth: 1,
    borderColor: color.border.default,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  pieceTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  photo: {
    width: 64,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: color.surface.muted,
  },
  pieceText: { flex: 1, gap: 2 },
  name: { fontWeight: '600' },
  prices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  price: { fontWeight: '600' },
  blurb: { marginTop: 2 },
  message: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: color.surface.inverse,
  },
});
