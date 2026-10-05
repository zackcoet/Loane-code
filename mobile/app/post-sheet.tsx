/**
 * The sheet behind the + button: "Post a Look" or "Add to My Closet".
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, iconSize, radius, spacing, type } from '@loane/shared';
import { Icon, type IconName } from '../src/components/Icon';
import { Logo } from '../src/components/Logo';

interface Option {
  title: string;
  body: string;
  href: '/add-to-closet' | '/post-look';
  icon: IconName;
}

const OPTIONS: Option[] = [
  {
    title: 'Post a look',
    body: 'Show off an outfit. Tag the pieces from your closet.',
    href: '/post-look',
    // Posting is the additive, expressive one, so it gets the plus.
    icon: 'add',
  },
  {
    title: 'Add to my closet',
    // Not "or just showcase" — showcasing is what Post a Look is for,
    // and offering it here made the two options sound like the same
    // thing with different names.
    body: 'List a garment to rent or sell.',
    href: '/add-to-closet',
    // A garment, which is what a closet is full of. Ionicons has no
    // hanger, and a shirt reads as clothes faster than a box would.
    icon: 'shirt-outline',
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
          <Icon name="close" size={iconSize.md} />
        </Pressable>
      </View>

      {OPTIONS.map((option) => (
        <Pressable
          key={option.title}
          style={styles.option}
          accessibilityRole="button"
          onPress={() => {
            router.back();
            router.push(option.href);
          }}
        >
          <View style={styles.optionIcon}>
            <Icon name={option.icon} size={iconSize.md} tint={color.accent.label} />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionBody}>{option.body}</Text>
          </View>
          <Icon name="chevron-forward" size={20} tint={color.text.muted} />
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    borderWidth: 1,
    borderColor: color.border.default,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  // Was an empty bordered square — a placeholder that shipped. These are
  // the only two things this sheet exists to start, so they carry the
  // accent rather than a hairline outline of nothing.
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.accent.background,
    alignItems: 'center',
    justifyContent: 'center',
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
});
