/**
 * A photo you can pin tags onto, and a photo that shows them.
 *
 * Positions are stored as FRACTIONS of the photo (0–1), never pixels —
 * the same photo renders at a different width on every phone, so a pixel
 * coordinate would drift off the garment. We convert to pixels only at
 * the moment of drawing. See docs/post-tagging.md.
 */

import { useCallback, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { color, controls, fontSize, formatCentsShort, radius, spacing } from '@loane/shared';
import { Icon } from './Icon';
import { Text } from './Text';

export interface PlacedTag {
  listingId: string;
  x: number;
  y: number;
  name: string;
  priceCents3Day: number | null;
  salePriceCents: number | null;
}

interface Props {
  uri: string;
  tags: PlacedTag[];
  /** Fires with fractional coordinates when she taps an empty spot. */
  onPlaceTag?: (x: number, y: number) => void;
  /** Composing: tapping a dot removes it. Viewing: it opens the label. */
  mode: 'compose' | 'view';
  /** View mode: whether the dots are currently showing. */
  tagsVisible?: boolean;
  onToggleTags?: () => void;
  onRemoveTag?: (listingId: string) => void;
  onOpenTag?: (listingId: string) => void;
  /** View mode: which label is expanded, if any. */
  expandedListingId?: string | null;
  onExpandTag?: (listingId: string) => void;
  /** Double tap to like, Instagram-style. View mode only. */
  onDoubleTap?: () => void;
  /**
   * Pinch to zoom, Instagram-style. View mode only, and off while she is
   * placing tags — zooming a photo she is trying to pin a dot onto would
   * put the dot in the wrong place.
   */
  zoomable?: boolean;
  aspectRatio?: number;
}

export function TaggablePhoto({
  uri,
  tags,
  onPlaceTag,
  mode,
  tagsVisible = true,
  onToggleTags,
  onRemoveTag,
  onOpenTag,
  expandedListingId,
  onExpandTag,
  onDoubleTap,
  zoomable = false,
  aspectRatio = 0.8,
}: Props) {
  // SHARED VALUES, not a ref. The gesture callbacks below are turned
  // into worklets by the reanimated babel plugin, and a worklet cannot
  // close over a React ref object — reading one throws "Property
  // 'layout' doesn't exist" the moment you tap a photo. Shared values
  // are the thing worklets are allowed to see, and they are writable
  // from the JS thread, so onLayout can still fill them.
  //
  // (Before the ref it was a plain `let`, recreated on every render, so
  // the measurement was thrown away each time. Both were wrong in
  // different ways.)
  const photoWidth = useSharedValue(0);
  const photoHeight = useSharedValue(0);
  const onLayout = (event: LayoutChangeEvent) => {
    photoWidth.value = event.nativeEvent.layout.width;
    photoHeight.value = event.nativeEvent.layout.height;
  };

  // Single tap shows the tags, double tap likes, two fingers zoom.
  //
  // ALL THREE ARE GESTURE HANDLER GESTURES, on purpose. This used to be
  // a React Native Pressable with a hand-rolled double-tap timer, and
  // when the pinch gesture arrived it was nested inside that Pressable
  // — two different touch systems arguing over the same finger, with
  // the native one taking the touch and the Pressable never firing. It
  // stopped taps on a photo working at all, which included the double
  // tap that likes. One system, composed explicitly, cannot do that.
  const heart = useRef(new Animated.Value(0)).current;

  const burst = useCallback(() => {
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(heart, { toValue: 0, duration: 420, delay: 260, useNativeDriver: true }),
    ]).start();
  }, [heart]);

  const scale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);

  const viewing = mode === 'view';

  // runOnJS, because everything these do — setting React state, calling
  // a Cloud Function — belongs on the JS thread.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .enabled(viewing && Boolean(onDoubleTap))
    .onEnd(() => {
      burst();
      onDoubleTap?.();
    });

  const singleTap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => {
      if (viewing) {
        onToggleTags?.();
        return;
      }
      if (!onPlaceTag) return;
      // Clamp, so a tap right on the edge still lands inside the photo.
      const x = Math.min(1, Math.max(0, event.x / Math.max(1, photoWidth.value)));
      const y = Math.min(1, Math.max(0, event.y / Math.max(1, photoHeight.value)));
      onPlaceTag(x, y);
    });

  // Pinch stays on the UI thread so the zoom tracks the fingers without
  // a round trip through JS. It springs back on release rather than
  // staying zoomed: a photo left at 3x in the middle of a feed is a
  // photo she then has to work out how to un-zoom.
  const pinch = Gesture.Pinch()
    .enabled(zoomable && viewing)
    .onUpdate((event) => {
      // Never smaller than life size, and a ceiling so it cannot be
      // thrown off into a blur.
      scale.value = Math.min(4, Math.max(1, event.scale));
    })
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 180 });
      panX.value = withTiming(0, { duration: 180 });
      panY.value = withTiming(0, { duration: 180 });
    });

  // Moving the zoomed photo under two fingers. Two, so a one-finger
  // drag still belongs to the carousel and the feed underneath it.
  const drag = Gesture.Pan()
    .enabled(zoomable && viewing)
    .minPointers(2)
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      panX.value = event.translationX;
      panY.value = event.translationY;
    })
    .onEnd(() => {
      panX.value = withTiming(0, { duration: 180 });
      panY.value = withTiming(0, { duration: 180 });
    });

  // Exclusive: the single tap waits to see whether a second one lands,
  // so liking never also toggles the tags. Simultaneous: a two-finger
  // zoom is not a tap and the two never need to exclude each other.
  const gestures = Gesture.Simultaneous(Gesture.Exclusive(doubleTap, singleTap), pinch, drag);

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
  }));

  const showDots = mode === 'compose' || tagsVisible;

  return (
    <View onLayout={onLayout} style={[styles.wrapper, { aspectRatio }]}>
      {/* The gestures are attached to the image ALONE. The tag dots are
          siblings rendered on top of it, not children, so a tap on a dot
          is the dot's and never also counts as a tap on the photo. */}
      <GestureDetector gesture={gestures}>
        <Reanimated.View style={[styles.image, zoomStyle]}>
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        </Reanimated.View>
      </GestureDetector>

      {showDots
        ? tags.map((tag) => {
            const expanded = mode === 'view' && expandedListingId === tag.listingId;
            // Flip the label to the left when the dot is near the right
            // edge, so it never runs off the photo.
            const flip = tag.x > 0.6;

            return (
              <View
                key={tag.listingId}
                style={[styles.anchor, { left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }]}
                pointerEvents="box-none"
              >
                <Pressable
                  onPress={() => {
                    if (mode === 'compose') onRemoveTag?.(tag.listingId);
                    else if (expanded) onOpenTag?.(tag.listingId);
                    else onExpandTag?.(tag.listingId);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={
                    mode === 'compose'
                      ? `Remove tag on ${tag.name}`
                      : expanded
                        ? `Open ${tag.name}`
                        : `Show ${tag.name}`
                  }
                  style={styles.dot}
                >
                  {mode === 'compose' ? (
                    <Icon name="close" size={12} tint={color.text.inverse} />
                  ) : null}
                </Pressable>

                {expanded ? (
                  <Pressable
                    onPress={() => onOpenTag?.(tag.listingId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${tag.name}`}
                    style={[styles.label, flip ? styles.labelLeft : styles.labelRight]}
                  >
                    <Text variant="caption" tone="inverse" numberOfLines={1}>
                      {tag.name}
                    </Text>
                    <Text variant="caption" tone="inverse">
                      {tag.priceCents3Day != null
                        ? `${formatCentsShort(tag.priceCents3Day)} · 3 days`
                        : tag.salePriceCents != null
                          ? `${formatCentsShort(tag.salePriceCents)} to buy`
                          : 'View piece'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        : null}

      {/* The heart that flashes up on a double tap. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.burst,
          {
            opacity: heart,
            transform: [
              { scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
            ],
          },
        ]}
      >
        <Icon name="heart" size={fontSize['6xl']} tint={color.text.inverse} />
      </Animated.View>

      {mode === 'view' && tags.length > 0 && !tagsVisible ? (
        <View style={styles.hint} pointerEvents="none">
          <Text variant="caption" tone="inverse">
            {tags.length === 1 ? '1 piece tagged' : `${tags.length} pieces tagged`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  wrapper: { width: '100%', backgroundColor: color.surface.muted },
  image: { width: '100%', height: '100%' },
  anchor: {
    position: 'absolute',
    // Centre the dot on the point rather than hanging it below and right.
    marginLeft: -DOT / 2,
    marginTop: -DOT / 2,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.surface.inverse,
    borderWidth: 2,
    borderColor: color.text.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    top: DOT + 6,
    minWidth: 130,
    maxWidth: 200,
    minHeight: controls.minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: color.surface.inverse,
  },
  labelRight: { left: 0 },
  labelLeft: { right: 0 },
  burst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstHeart: {
    fontSize: fontSize['6xl'],
    lineHeight: 110,
    color: color.text.inverse,
    // A shadow so it reads on a pale photo as well as a dark one.
    textShadowColor: color.shadow.textOnPhoto,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  hint: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: color.surface.inverse,
    opacity: 0.85,
  },
});
