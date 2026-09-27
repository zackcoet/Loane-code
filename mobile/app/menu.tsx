/**
 * The side menu from the mockups.
 *
 * Every row goes somewhere. The ones whose real screens are later phases
 * land on a small "coming in Phase N" placeholder rather than dead-ending
 * on nothing — a row that does nothing feels broken.
 */

import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { signOut } from 'firebase/auth';
import {
  color,
  controls,
  iconSize,
  spacing,
  type,
} from '@loane/shared';
import { IconButton } from '../src/components/IconButton';
import { Logo } from '../src/components/Logo';
import { auth } from '../src/firebase/config';
import { useUnreadMessageCount } from '../src/hooks/useMessaging';

interface Item {
  label: string;
  href: Href;
  /** Shown as a count on the right, e.g. unread messages. */
  badge?: number;
}

const ITEMS: Item[] = [
  { label: 'Post a Look / Add to My Closet', href: '/post-sheet' },
  { label: 'Liked', href: '/(tabs)/activity' },
  { label: 'Saved', href: '/my-wishlist' },
  { label: 'Recently Rented', href: '/my-rentals' },
  { label: 'My Listings', href: '/my-listings' },
  { label: 'My Rentals', href: '/my-rentals' },
  { label: 'My Wishlist', href: '/my-wishlist' },
  { label: 'Activity', href: '/(tabs)/activity' },
  { label: 'Messages', href: '/messages' },
  { label: 'Find Friends', href: '/find-friends' },
  { label: 'Invite Friends', href: '/invite-friends' },
  { label: 'Payouts & Payment Info', href: '/payouts' },
  { label: 'Safety', href: '/help' },
  { label: 'Help & Support', href: '/help' },
];

export default function Menu() {
  const router = useRouter();
  const unreadMessages = useUnreadMessageCount();

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Logo size={30} lockup="below" />
        <IconButton name="close" onPress={() => router.back()} accessibilityLabel="Close menu" />
      </View>

      <ScrollView>
        {ITEMS.map((raw) => {
          const item =
            raw.href === '/messages' ? { ...raw, badge: unreadMessages } : raw;
          return (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
          >
            <Text style={styles.rowLabel}>{item.label}</Text>
            <View style={styles.rowRight}>
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                </View>
              ) : null}
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
          );
        })}

        <Pressable
          style={({ pressed }) => [styles.row, styles.logOut, pressed && styles.rowPressed]}
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
  sheet: { flex: 1, backgroundColor: color.surface.page, paddingTop: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: controls.minTapTarget + 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  rowPressed: { backgroundColor: color.surface.muted },
  rowLabel: { fontSize: type.body.size, color: color.text.primary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: color.surface.inverse,
  },
  badgeText: { fontSize: type.caption.size, color: color.text.inverse, textAlign: 'center' },
  chevron: { fontSize: iconSize.sm, color: color.text.muted },
  logOut: { marginTop: spacing.lg },
});
