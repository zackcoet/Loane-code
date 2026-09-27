/**
 * Activity — followers, likes, messages and rental updates.
 * Phase 0: header and empty state. Wired up in Phase 6.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  color,
  controls,
  spacing,
  type,
} from '@loane/shared';
import { IconButton } from '../../src/components/IconButton';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';

export default function Activity() {
  const router = useRouter();

  return (
    <Screen flush>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Activity</Text>
        <IconButton
          glyph="✉"
          onPress={() => router.push('/messages')}
          accessibilityLabel="Messages"
        />
      </View>

      {/* TODO-PHASE6: notifications list. */}
      <EmptyState
        title="No activity yet"
        body="Your followers, likes, messages and rental updates will show up here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    height: controls.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  headerSpacer: { width: controls.minTapTarget },
  title: {
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.primary,
  },
});
