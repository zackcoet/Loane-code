/**
 * The photo picker grid used when listing a garment.
 *
 * The FIRST photo is the cover — it is what shows in the marketplace grid
 * and in a post's tag row, so it matters. Rather than drag-and-drop, which
 * needs a gesture library and is fiddly on a phone, tapping a photo offers
 * "Make cover" or "Remove". Same outcome, a tenth the code.
 */

import { ActionSheetIOS, Alert, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, spacing, type } from '@loane/shared';
import { Text } from './Text';

export interface GridPhoto {
  /** Local file uri while picking, remote url once uploaded. */
  uri: string;
}

interface Props {
  photos: GridPhoto[];
  max: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMakeCover: (index: number) => void;
  /**
   * Crop this one to a centred square. Optional: photos keep their own
   * shape now, and this is the way back for a shot that suits a square.
   */
  onCrop?: (index: number) => void;
  /** True while an upload is in flight. */
  busy?: boolean;
}

export function PhotoGrid({ photos, max, onAdd, onRemove, onMakeCover, onCrop, busy }: Props) {
  const openMenu = (index: number) => {
    const isCover = index === 0;
    // Built as a list so the two optional entries cannot get out of
    // step with the indexes the handler checks.
    const actions: { label: string; run: () => void; destructive?: boolean }[] = [
      ...(isCover ? [] : [{ label: 'Make cover', run: () => onMakeCover(index) }]),
      ...(onCrop ? [{ label: 'Crop to square', run: () => onCrop(index) }] : []),
      { label: 'Remove photo', run: () => onRemove(index), destructive: true },
    ];
    const options = ['Cancel', ...actions.map((a) => a.label)];

    const handle = (choice: number) => {
      actions[choice - 1]?.run();
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: options.length - 1 },
        handle,
      );
    } else {
      Alert.alert('Photo', undefined, [
        ...actions.map((a) => ({
          text: a.label,
          style: a.destructive ? ('destructive' as const) : undefined,
          onPress: a.run,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <View style={styles.grid}>
      {photos.map((photo, index) => (
        <Pressable
          key={`${photo.uri}-${index}`}
          onPress={() => openMenu(index)}
          accessibilityRole="button"
          accessibilityLabel={
            index === 0 ? 'Cover photo. Tap for options.' : 'Photo. Tap for options.'
          }
          style={styles.tile}
        >
          <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
          {index === 0 ? (
            <View style={styles.coverBadge}>
              <Text variant="caption" tone="inverse">
                Cover
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}

      {photos.length < max ? (
        <Pressable
          onPress={onAdd}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Add a photo"
          style={[styles.tile, styles.addTile, busy && styles.addBusy]}
        >
          <Text variant="h3" tone="muted">
            {busy ? '…' : '+'}
          </Text>
          <Text variant="caption" tone="muted">
            {busy ? 'Adding' : 'Add photo'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: controls.thumbnail,
    height: controls.thumbnail,
    borderWidth: 1,
    borderColor: color.border.default,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: color.surface.inverse,
    paddingVertical: 2,
    alignItems: 'center',
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: color.surface.muted,
    borderStyle: 'dashed',
  },
  addBusy: { opacity: 0.6 },
  label: { fontSize: type.caption.size },
});
