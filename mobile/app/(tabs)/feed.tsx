/**
 * Feed — the social home. Outfit posts from her campus.
 *
 * Phase 0: header, campus filter and the empty state. The feed itself is
 * Phase 3.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@loane/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';

export default function Feed() {
  const router = useRouter();
  const { profile } = useAuth();

  return (
    <Screen flush>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/menu')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Text style={styles.menuGlyph}>≡</Text>
        </Pressable>
        <Logo size={26} />
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterRow}>
        <Pressable style={styles.campusChip} accessibilityRole="button">
          <View style={styles.campusDot} />
          <Text style={styles.campusText}>All Campus</Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>
        <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel="Search">
          <Text style={styles.searchGlyph}>⌕</Text>
        </Pressable>
      </View>

      {/* TODO-PHASE3: the real feed. */}
      <EmptyState
        title="No looks yet"
        body={
          profile
            ? 'Be the first to post an outfit from your campus.'
            : 'Be the first to post an outfit from your campus.'
        }
        actionLabel="Post a look"
        onAction={() => router.push('/post-sheet')}
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
  },
  headerSpacer: { width: 22 },
  menuGlyph: { fontSize: 22, color: colors.black },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  campusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  campusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.black,
    marginRight: spacing.sm,
  },
  campusText: { fontSize: typography.bodySmall.size, color: colors.textPrimary },
  chevron: { marginLeft: 6, fontSize: 12, color: colors.textSecondary },
  searchGlyph: { fontSize: 20, color: colors.black },
});
