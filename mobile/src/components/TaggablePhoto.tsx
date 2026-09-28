/**
 * A photo you can pin tags onto, and a photo that shows them.
 *
 * Positions are stored as FRACTIONS of the photo (0–1), never pixels —
 * the same photo renders at a different width on every phone, so a pixel
 * coordinate would drift off the garment. We convert to pixels only at
 * the moment of drawing. See docs/post-tagging.md.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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

/** How close two taps have to be to count as a double tap. */
const DOUBLE_TAP_MS = 280;

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
  let size = { width: 0, height: 0 };

  const onLayout = (event: LayoutChangeEvent) => {
    size = event.nativeEvent.layout;
  };

  // Single tap shows the tags, double tap likes. Telling them apart
  // means holding the single tap for a moment to see whether a second
  // one arrives — which is why revealing tags feels very slightly lazy.
  const lastTap = useRef(0);
  const pendingSingle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heart = useRef(new Animated.Value(0)).current;

  useEffect(
    () => () => {
      if (pendingSingle.current) clearTimeout(pendingSingle.current);
    },
    [],
  );

  const burst = useCallback(() => {
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(heart, { toValue: 0, duration: 420, delay: 260, useNativeDriver: true }),
    ]).start();
  }, [heart]);

  const handlePress = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (mode === 'view') {
      const now = Date.now();

      if (now - lastTap.current < DOUBLE_TAP_MS) {
        // Second tap: cancel the pending tag toggle and like instead.
        if (pendingSingle.current) clearTimeout(pendingSingle.current);
        pendingSingle.current = null;
        lastTap.current = 0;
        if (onDoubleTap) {
          burst();
          onDoubleTap();
        }
        return;
      }

      lastTap.current = now;
      pendingSingle.current = setTimeout(() => {
        pendingSingle.current = null;
        onToggleTags?.();
      }, DOUBLE_TAP_MS);
      return;
    }
    if (!onPlaceTag || size.width === 0) return;
    const { locationX, locationY } = event.nativeEvent;
    // Clamp, so a tap right on the edge still lands inside the photo.
    const x = Math.min(1, Math.max(0, locationX / size.width));
    const y = Math.min(1, Math.max(0, locationY / size.height));
    onPlaceTag(x, y);
  };

  const showDots = mode === 'compose' || tagsVisible;

  // --- Pinch to zoom -------------------------------------------------------
  // Two fingers, so it never competes with the single tap that reveals
  // the tags or the double tap that likes. It springs back on release
  // rather than staying zoomed: a photo left at 3x in the middle of a
  // feed is a photo she then has to work out how to un-zoom.
  const scale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .enabled(zoomable && mode === 'view')
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

  // Moving the zoomed photo around under two fingers. One finger is left
  // alone so the carousel can still be swiped.
  const drag = Gesture.Pan()
    .enabled(zoomable && mode === 'view')
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

  const zoom = Gesture.Simultaneous(pinch, drag);

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Pressable onPress={handlePress} onLayout={onLayout} style={[styles.wrapper, { aspectRatio }]}>
      <GestureDetector gesture={zoom}>
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
                style={[
                  styles.anchor,
                  { left: `${tag.x * 100}%`, top: `${tag.y * 100}%` },
                ]}
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
            transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
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
    </Pressable>
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
    textShadowColor: 'rgba(0,0,0,0.35)',
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
