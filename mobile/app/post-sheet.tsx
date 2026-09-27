/**
 * The sheet behind the + button: "Post a Look" or "Add to My Closet".
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  color,
  iconSize,
  spacing,
  type,
} from '@loane/shared';
import { Logo } from '../src/components/Logo';

interface Option {
  title: string;
  body: string;
  /** Null while the destination is a later phase. */
  href: '/add-to-closet' | null;
}

const OPTIONS: Option[] = [
  {
    title: 'Post a look',
    body: 'Show off an outfit. Tag the pieces from your closet.',
    // TODO-PHASE3: posting looks.
    href: null,
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
          <Logo size={30} lockup="mark" />
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
          onPress={() => {
            router.back();
            if (option.href) router.push(option.href);
          }}
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
    backgroundColor: color.surface.page,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  handleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  spacer: { width: 32, alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  kicker: {
    marginTop: spacing.sm,
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.muted,
  },
  close: { fontSize: iconSize.sm, color: color.icon.default },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    borderWidth: 1,
    borderColor: color.border.default,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: color.border.default,
    marginRight: spacing.md,
  },
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: type.label.size,
    letterSpacing: type.label.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.primary,
  },
  optionBody: { fontSize: type.bodySmall.size, color: color.text.secondary, marginTop: 4 },
  chevron: { fontSize: iconSize.md, color: color.text.muted },
});
