/**
 * The walkthrough: five coach-marks over the tab bar, once.
 *
 * SKIP IS ON EVERY STEP, and skipping counts as finishing. A tour you
 * have to sit through is a tour people learn to resent, and asking
 * again after she said no would be ignoring her.
 *
 * SHOWN ONCE, EVER, and replayable from Help. The timestamp lives on
 * her private settings, so it survives a reinstall and a new phone.
 *
 * THE HIGHLIGHT POSITIONS ARE COMPUTED, NOT MEASURED. The tab bar is
 * five equal slots across the screen, so slot centres are
 * width/5 × (i + 0.5) — exact, with no layout measurement to go stale
 * when a screen re-renders underneath. If the bar ever stops being
 * five equal slots, this is the thing that has to change with it.
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { color, radius, spacing } from '@loane/shared';
import { Button } from './Button';
import { Text } from './Text';

interface Step {
  /** Which of the five tab slots to ring, or null for the whole screen. */
  slot: number | null;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    slot: 0,
    title: 'Your campus feed',
    body: 'Looks from students at USC. Tap a tagged piece to rent it.',
  },
  {
    slot: 1,
    title: 'Find a piece',
    body: 'Search closets by occasion, size or price — gameday, formals, rush.',
  },
  {
    slot: 2,
    title: 'Share or lend',
    body: 'Post a look, or put a piece of yours on Loane for someone else to rent.',
  },
  {
    slot: 4,
    title: 'Saved, and try-on',
    body: 'Heart a piece to save it. From Saved you can see it on yourself before you ask.',
  },
  {
    slot: 3,
    title: 'Your rentals live here',
    body: 'Requests, handoffs and returns. A dot means something needs you.',
  },
];

/** The bar is five equal slots. See the note at the top. */
const SLOTS = 5;

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function Walkthrough({ visible, onDone }: Props) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (!visible) return null;
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;

  const ringSize = 64;
  const centreX = step.slot == null ? width / 2 : (width / SLOTS) * (step.slot + 0.5);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      {/* Dimmed, but the app is still visible behind it — the point is
          to show her where things are, not to replace the screen. */}
      <View style={styles.scrim}>
        {step.slot != null ? (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              { width: ringSize, height: ringSize, left: centreX - ringSize / 2 },
            ]}
          />
        ) : null}

        <View style={styles.card}>
          <Text variant="caption" tone="muted">
            {index + 1} of {STEPS.length}
          </Text>
          <Text variant="h3" tone="heading">
            {step.title}
          </Text>
          <Text variant="bodySmall" tone="secondary" uppercase={false}>
            {step.body}
          </Text>

          <Button
            label={last ? 'Got it' : 'Next'}
            onPress={() => (last ? onDone() : setIndex((i) => i + 1))}
          />
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

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim.onPhoto, justifyContent: 'flex-end' },
  ring: {
    position: 'absolute',
    // Just above the tab bar, which is where all five live.
    bottom: 8,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.surface.raised,
  },
  card: {
    margin: spacing.md,
    marginBottom: 120,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: color.surface.raised,
  },
  skip: { alignSelf: 'center', padding: spacing.sm },
  skipLabel: { textDecorationLine: 'underline' },
});
