/**
 * The walkthrough: five coach-marks over the real tab bar, once.
 *
 * PLACEMENT RULE:
 * Every spotlight circle is positioned from the measured `measureInWindow`
 * rectangle of the actual element it points at, in the same window
 * coordinate space as this transparent Modal. Do not place tour targets
 * from tab indexes, hard-coded offsets, status-bar guesses or assumed tab
 * bar heights. Re-measure when the overlay opens, the step changes, or the
 * screen layout changes.
 *
 * SKIP IS ON EVERY STEP, and skipping counts as finishing. A tour you
 * have to sit through is a tour people learn to resent, and asking
 * again after she said no would be ignoring her.
 *
 * SHOWN ONCE, EVER, and replayable from Help. The timestamp lives on
 * her private settings, so it survives a reinstall and a new phone.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { color, radius, spacing } from '@loane/shared';
import { Button } from './Button';
import { Text } from './Text';
import {
  useWalkthroughTargets,
  type WalkthroughRect,
  type WalkthroughTargetKey,
} from './WalkthroughTargets';

interface Step {
  target: WalkthroughTargetKey;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: 'feed',
    title: 'Your campus feed',
    body: 'Looks from students at USC. Tap a tagged piece to rent it.',
  },
  {
    target: 'search',
    title: 'Find a piece',
    body: 'Search closets by occasion, size or price — gameday, formals, rush.',
  },
  {
    target: 'messages',
    title: 'Your messages',
    body: 'Handoffs get arranged here. A dot means somebody is waiting on you.',
  },
  {
    target: 'post',
    title: 'Share or lend',
    body: 'Post a look, or put a piece of yours on Loane for someone else to rent.',
  },
  {
    target: 'profile',
    title: 'Saved pieces',
    body: 'Heart a piece to save it, and find it again here.',
  },
  {
    target: 'activity',
    title: 'Your rentals live here',
    body: 'Requests, handoffs and returns. A dot means something needs you.',
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

interface Ring {
  left: number;
  top: number;
  size: number;
  centerY: number;
}

export function Walkthrough({ visible, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const { rects, measureTargets } = useWalkthroughTargets();
  const [index, setIndex] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);

  useEffect(() => {
    if (!visible) setIndex(0);
  }, [visible]);

  const step = STEPS[index]!;
  const rect = rects[step.target];
  const last = index === STEPS.length - 1;

  useEffect(() => {
    if (visible) measureTargets();
  }, [index, measureTargets, visible, width, height]);

  const ring = useMemo(
    () => (rect ? ringFromRect(rect, width, height) : null),
    [rect, width, height],
  );
  const cardTop = ring && cardHeight > 0 ? bubbleTop(ring, cardHeight, height) : null;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      {/* Dimmed, but the app is still visible behind it — the point is
          to show her where things are, not to replace the screen. */}
      <View style={styles.scrim}>
        {ring ? (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                width: ring.size,
                height: ring.size,
                left: ring.left,
                top: ring.top,
              },
            ]}
          />
        ) : null}

        <View
          onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
          style={[
            styles.card,
            cardTop != null && { top: cardTop },
            cardTop == null && styles.cardMeasuring,
          ]}
        >
          <Text variant="caption" tone="muted">
            {index + 1} of {STEPS.length}
          </Text>
          <Text variant="h3" tone="heading">
            {step.title}
          </Text>
          <Text variant="bodySmall" tone="secondary" uppercase={false}>
            {step.body}
          </Text>

          <View style={styles.actions}>
            {index > 0 ? (
              <Button
                label="Back"
                variant="outline"
                onPress={() => setIndex((current) => Math.max(0, current - 1))}
                style={styles.actionButton}
              />
            ) : null}
            <Button
              label={last ? 'Got it' : 'Next'}
              onPress={() => (last ? onDone() : setIndex((current) => current + 1))}
              style={styles.actionButton}
            />
          </View>
          {/* On every step, not just the first. */}
          <Pressable onPress={onDone} accessibilityRole="button" style={styles.skip}>
            <Text variant="caption" tone="muted" uppercase={false} style={styles.skipLabel}>
              Skip
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ringFromRect(rect: WalkthroughRect, screenWidth: number, screenHeight: number): Ring {
  const size = Math.max(rect.width, rect.height) + spacing.md;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return {
    left: clamp(centerX - size / 2, spacing.xs, screenWidth - size - spacing.xs),
    top: clamp(centerY - size / 2, spacing.xs, screenHeight - size - spacing.xs),
    size,
    centerY,
  };
}

function bubbleTop(ring: Ring, cardHeight: number, screenHeight: number): number {
  const targetIsLow = ring.centerY > screenHeight / 2;
  const preferred = targetIsLow
    ? ring.top - cardHeight - spacing.md
    : ring.top + ring.size + spacing.md;
  return clamp(preferred, spacing.md, screenHeight - cardHeight - spacing.md);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim.onPhoto },
  ring: {
    position: 'absolute',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.surface.raised,
  },
  card: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: color.surface.raised,
  },
  cardMeasuring: { opacity: 0 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
  skip: { alignSelf: 'center', padding: spacing.sm },
  skipLabel: { textDecorationLine: 'underline' },
});
