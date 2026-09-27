/**
 * Page shell: white background, safe-area aware, consistent side padding.
 */

import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  color,
  spacing,
} from '@loane/shared';

interface Props {
  children: React.ReactNode;
  /** Wrap the content in a ScrollView. Off for full-height empty states. */
  scroll?: boolean;
  /** Remove the horizontal padding, for edge-to-edge feeds. */
  flush?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, scroll = false, flush = false, style }: Props) {
  const inner = [styles.inner, flush ? null : styles.padded, style];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, styles.scrollContent]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={inner}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.surface.page },
  inner: { flex: 1 },
  padded: { paddingHorizontal: spacing.screenPadding },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
});
