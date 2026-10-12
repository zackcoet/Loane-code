/**
 * A cream band across the page.
 *
 * Cream is an accent now, not the canvas — Ella's note was that a whole
 * screen of it felt dirty. This is how a long white screen gets broken
 * into parts: a cream strip behind a summary, a header, a group of rows.
 *
 * Full-bleed by default, because a cream block with white either side of
 * it reads as a mistake rather than a band.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, spacing } from '@loane/shared';

interface Props {
  children: React.ReactNode;
  /** Keeps the horizontal page padding, for a band inside a padded screen. */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Section({ children, inset = false, style }: Props) {
  return <View style={[styles.band, inset && styles.inset, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: color.surface.section,
    paddingVertical: spacing.lg,
  },
  inset: { paddingHorizontal: spacing.screenPadding },
});
