/**
 * The side menu from the mockups.
 *
 * Most destinations are later phases, so tapping them does nothing yet
 * rather than dead-ending on a broken screen. Log Out works today.
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { colors, spacing, typography } from '@loane/shared';
import { Logo } from '../src/components/Logo';
import { auth } from '../src/firebase/config';

interface Item {
  label: string;
  href?: string;
  /** Which phase builds it. Shown as a quiet "soon" while unbuilt. */
  soon?: boolean;
}

const ITEMS: Item[] = [
  { label: 'My Listings', soon: true },
  { label: 'My Rentals', href: '/my-rentals' },
  { label: 'My Wishlist', soon: true },
  { label: 'Activity', href: '/(tabs)/activity' },
  { label: 'Find Friends', soon: true },
  { label: 'Invite Friends', soon: true },
  { label: 'Payouts & Payment Info', soon: true },
  { label: 'Safety', href: '/help' },
  { label: 'Help & Support', href: '/help' },
];

export default function Menu() {
  const router = useRouter();

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Logo size={24} />
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <ScrollView>
        {ITEMS.map((item) => (
          <Pressable
            key={item.label}
            style={styles.row}
            accessibilityRole="button"
            disabled={item.soon}
            onPress={() => {
              if (item.href) router.push(item.href as never);
            }}
          >
            <Text style={[styles.rowLabel, item.soon && styles.rowLabelSoon]}>{item.label}</Text>
            {item.soon ? <Text style={styles.soon}>Soon</Text> : null}
          </Pressable>
        ))}

        <Pressable
          style={[styles.row, styles.logOut]}
          accessibilityRole="button"
          onPress={async () => {
            router.back();
            await signOut(auth);
          }}
        >
          <Text style={styles.rowLabel}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.white, paddingTop: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  close: { fontSize: 18, color: colors.black },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: { fontSize: typography.body.size, color: colors.textPrimary },
  rowLabelSoon: { color: colors.textMuted },
  soon: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  logOut: { marginTop: spacing.lg },
});
