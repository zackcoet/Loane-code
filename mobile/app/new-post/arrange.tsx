/**
 * Step 2 of posting a look — arrange the photos she just picked.
 *
 * Swipe through them, drag the filmstrip to reorder, remove one, crop
 * one, add more.
 *
 * EVERY CONTROL SITS ON THE PHOTO OR IN A FIXED BAR. The old screen put
 * "Remove photo" in a row underneath, which was pushed off the bottom as
 * soon as there were a couple of pictures, and a button you cannot reach
 * is the same as a button that does not exist.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LIMITS, color, controls, radius, spacing } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Header } from '../../src/components/Header';
import { Icon } from '../../src/components/Icon';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { usePostDraft, type DraftPhoto } from '../../src/post/postDraft';
import { cropPhoto, pickPhotos } from '../../src/lib/photo';

const THUMB = 56;
const THUMB_GAP = spacing.sm;
const THUMB_STRIDE = THUMB + THUMB_GAP;

export default function ArrangePhotos() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const draft = usePostDraft();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<DraftPhoto>>(null);

  const photos = draft.photos;
  const current = photos[Math.min(index, photos.length - 1)];

  // She removed the last photo, or arrived here with none.
  if (photos.length === 0) {
    return (
      <Screen>
        <Header title="New post" onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text variant="bodySmall" tone="secondary" style={styles.emptyText}>
            No photos yet.
          </Text>
          <Button label="Choose photos" onPress={() => void onAddMore()} />
        </View>
      </Screen>
    );
  }

  async function onAddMore() {
    const room = LIMITS.postPhotos.max - draft.photos.length;
    if (room <= 0) {
      Alert.alert('That is the limit', `A look can have up to ${LIMITS.postPhotos.max} photos.`);
      return;
    }
    const picked = await pickPhotos(room);
    if (picked.length > 0) draft.addPhotos(picked);
  }

  async function onCrop() {
    if (!current) return;
    // A square crop from the centre is the one crop worth offering as a
    // single tap; anything else needs a real crop tool, which iOS only
    // gives us for a fresh single pick.
    const { width: w, height: h } = current.picked;
    const side = Math.min(w, h);
    await draft.replacePhoto(
      current.id,
      await cropPhoto(current.picked, {
        x: (w - side) / 2 / w,
        y: (h - side) / 2 / h,
        width: side / w,
        height: side / h,
      }),
    );
  }

  function onRemove() {
    if (!current) return;
    const hadTags = current.tags.length > 0;
    const drop = () => {
      draft.removePhoto(current.id);
      setIndex((i) => Math.max(0, Math.min(i, draft.photos.length - 2)));
    };

    // Removing a photo quietly throws away the tags placed on it, which
    // is work she will not get back.
    if (hadTags) {
      Alert.alert(
        'Remove this photo?',
        `It has ${current.tags.length} ${current.tags.length === 1 ? 'tag' : 'tags'} on it.`,
        [
          { text: 'Keep', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: drop },
        ],
      );
      return;
    }
    drop();
  }

  function onPressPhotoActions() {
    if (Platform.OS !== 'ios') {
      void onCrop();
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Crop to square'], cancelButtonIndex: 0 },
      (choice) => {
        if (choice === 1) void onCrop();
      },
    );
  }

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const goTo = (to: number) => {
    setIndex(to);
    list.current?.scrollToIndex({ index: to, animated: true });
  };

  return (
    <Screen flush>
      <Header title="New post" onBack={() => router.back()} />

      <FlatList
        ref={list}
        data={photos}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <Image source={{ uri: item.picked.uri }} style={styles.photo} resizeMode="contain" />
          </View>
        )}
      />

      {/* On the photo, never in a row below it. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable
          onPress={onRemove}
          style={styles.overlayButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove this photo"
        >
          <Icon name="close" size={20} tint={color.accent.label} />
        </Pressable>
        <Pressable
          onPress={onPressPhotoActions}
          style={styles.overlayButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Crop this photo"
        >
          <Icon name="crop" size={20} tint={color.accent.label} />
        </Pressable>
      </View>

      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <View style={styles.filmstrip}>
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filmstripContent}
          renderItem={({ item, index: i }) => (
            <Thumb
              photo={item}
              index={i}
              count={photos.length}
              active={i === index}
              onPress={() => goTo(i)}
              onMove={(to) => {
                draft.movePhoto(i, to);
                goTo(to);
              }}
            />
          )}
          ListFooterComponent={
            photos.length < LIMITS.postPhotos.max ? (
              <Pressable
                onPress={() => void onAddMore()}
                style={styles.addTile}
                accessibilityRole="button"
                accessibilityLabel="Add more photos"
              >
                <Icon name="add" size={22} tint={color.text.muted} />
              </Pressable>
            ) : null
          }
        />
      </View>

      <View style={styles.footer}>
        <Button label="Next" onPress={() => router.push('/new-post/details')} />
      </View>
    </Screen>
  );
}

/**
 * One filmstrip thumbnail. Long-press and drag to reorder.
 *
 * The maths is simple because every thumbnail is the same width: how many
 * whole strides the finger has travelled is how many places it moves.
 */
function Thumb({
  photo,
  index,
  count,
  active,
  onPress,
  onMove,
}: {
  photo: DraftPhoto;
  index: number;
  count: number;
  active: boolean;
  onPress: () => void;
  onMove: (to: number) => void;
}) {
  const offset = useSharedValue(0);
  const lifted = useSharedValue(0);

  const drag = Gesture.Pan()
    // Activating only after a long press means an ordinary tap still
    // selects, and a horizontal scroll of the strip still scrolls.
    .activateAfterLongPress(200)
    .onStart(() => {
      lifted.value = 1;
    })
    .onUpdate((e) => {
      offset.value = e.translationX;
    })
    .onEnd(() => {
      const places = Math.round(offset.value / THUMB_STRIDE);
      const to = Math.max(0, Math.min(count - 1, index + places));
      offset.value = 0;
      lifted.value = 0;
      if (to !== index) runOnJS(onMove)(to);
    })
    .onFinalize(() => {
      offset.value = 0;
      lifted.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { scale: lifted.value ? 1.08 : 1 }],
    zIndex: lifted.value ? 2 : 1,
    opacity: lifted.value ? 0.9 : 1,
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={style}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Photo ${index + 1} of ${count}`}
          style={[styles.thumb, active && styles.thumbActive]}
        >
          <Image source={{ uri: photo.picked.uri }} style={styles.thumbImage} />
          {photo.tags.length > 0 ? (
            <View style={styles.thumbBadge}>
              <Text variant="caption" style={styles.thumbBadgeText} uppercase={false}>
                {photo.tags.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface.muted },
  photo: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { textAlign: 'center' },
  overlay: {
    position: 'absolute',
    top: controls.headerHeight + spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  overlayButton: {
    width: controls.minTapTarget,
    height: controls.minTapTarget,
    borderRadius: radius.pill,
    backgroundColor: color.accent.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.border.strong },
  dotActive: { backgroundColor: color.accent.background },
  filmstrip: { paddingVertical: spacing.sm },
  filmstripContent: { paddingHorizontal: spacing.md, gap: THUMB_GAP, alignItems: 'center' },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.surface.muted,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: { borderColor: color.accent.border },
  thumbImage: { width: '100%', height: '100%' },
  thumbBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: color.accent.background,
    alignItems: 'center',
  },
  thumbBadgeText: { color: color.accent.label, fontWeight: '600' },
  addTile: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: THUMB_GAP,
  },
  footer: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
