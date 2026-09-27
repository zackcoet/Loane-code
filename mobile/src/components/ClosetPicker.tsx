/**
 * "Which piece is this?" — the sheet that opens after she taps a spot on
 * a photo.
 *
 * Only her own active listings appear. That is the launch rule, and the
 * server enforces it too; this just means she never sees an option that
 * would be refused. See docs/post-tagging.md.
 */

import { FlatList, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, formatCentsShort, spacing, type Listing } from '@loane/shared';
import { EmptyState } from './EmptyState';
import { Header } from './Header';
import { Text } from './Text';

interface Props {
  visible: boolean;
  listings: Listing[];
  /** Already tagged on this photo, so they are not offered twice. */
  takenIds: string[];
  onPick: (listing: Listing) => void;
  onClose: () => void;
}

export function ClosetPicker({ visible, listings, takenIds, onPick, onClose }: Props) {
  const available = listings.filter((l) => !takenIds.includes(l.id));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <Header title="Tag a piece" onBack={onClose} />

        {available.length === 0 ? (
          <EmptyState
            title={listings.length === 0 ? 'Nothing in your closet yet' : 'All tagged'}
            body={
              listings.length === 0
                ? 'Add a piece to your closet and you can tag it in your looks.'
                : 'Every piece in your closet is already tagged on this photo.'
            }
          />
        ) : (
          <FlatList
            data={available}
            keyExtractor={(listing) => listing.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                accessibilityRole="button"
                accessibilityLabel={`Tag ${item.name}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                {item.coverUrl ? (
                  <Image source={{ uri: item.coverUrl }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
                <View style={styles.rowText}>
                  <Text numberOfLines={1}>{item.name}</Text>
                  <Text variant="bodySmall" tone="secondary">
                    {item.pricing.threeDayCents != null
                      ? `${formatCentsShort(item.pricing.threeDayCents)} · 3 days`
                      : item.salePriceCents != null
                        ? `${formatCentsShort(item.salePriceCents)} to buy`
                        : '—'}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.surface.page },
  list: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: controls.minTapTarget,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  rowPressed: { backgroundColor: color.surface.muted },
  thumb: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
  },
  thumbEmpty: {},
  rowText: { flex: 1, marginLeft: spacing.md },
});
