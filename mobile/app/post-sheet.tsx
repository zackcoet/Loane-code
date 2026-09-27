/**
 * The sheet behind the + button: "Post a Look" or "Add to My Closet".
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@loane/shared';
import { Logo } from '../src/components/Logo';

interface Option {
  title: string;
  body: string;
  href: string;
}

const OPTIONS: Option[] = [
  {
    title: 'Post a look',
    body: 'Show off an outfit. Tag the pieces from your closet.',
    href: '/post-look',
  },
  {
    title: 'Add to my closet',
    body: 'List a garment to rent, sell, or just showcase.',
    href: '/add-to-closet',
  },
];

export default function PostSheet() {
  const router = useRouter();

  return (
    <View style={styles.sheet}>
      <View style={styles.handleRow}>
        <View style={styles.spacer} />
        <View style={styles.center}>
          <Logo size={26} showWordmark={false} />
          <Text style={styles.kicker}>Share</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.spacer}
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      {OPTIONS.map((option) => (
        <Pressable
          key={option.title}
          style={styles.option}
          accessibilityRole="button"
          // TODO-PHASE2/3: these screens are built in later phases.
          onPress={() => router.back()}
        >
          <View style={styles.optionIcon} />
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionBody}>{option.body}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  handleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  spacer: { width: 32, alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  kicker: {
    marginTop: spacing.sm,
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  close: { fontSize: 18, color: colors.black },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.md,
  },
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  optionBody: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  chevron: { fontSize: 20, color: colors.textMuted },
});
