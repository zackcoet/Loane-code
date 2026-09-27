/**
 * Activity — followers, likes, messages and rental updates.
 * Phase 0: header and empty state. Wired up in Phase 6.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@loane/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';

export default function Activity() {
  const router = useRouter();

  return (
    <Screen flush>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Activity</Text>
        <Pressable
          onPress={() => router.push('/messages')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Messages"
        >
          <Text style={styles.glyph}>✉</Text>
        </Pressable>
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerSpacer: { width: 22 },
  title: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  glyph: { fontSize: 18, color: colors.black },
});
