/**
 * The side panel behind the hamburger.
 *
 * Built as a slide-in panel rather than a real navigation Drawer. A
 * Drawer would give edge-swipe for free, but it means wrapping the tab
 * layout in another navigator, and that is a lot of structural risk for
 * a panel opened from one button. If we later want the swipe, that is
 * the moment to switch.
 *
 * Quick access sits at the top — Liked, Saved, Recently Rented — because
 * those are the three things people come back for. Everything else is
 * the settings-shaped list underneath.
 */

import { useEffect, useRef } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { color, controls, iconSize, spacing } from '@loane/shared';
import { Icon, type IconName } from '../src/components/Icon';
import { IconButton } from '../src/components/IconButton';
import { Logo } from '../src/components/Logo';
import { Text } from '../src/components/Text';
import { auth } from '../src/firebase/config';
import { useMyBookings } from '../src/hooks/useBookings';

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.84);

interface Item {
  label: string;
  icon: IconName;
  href: Href;
  badge?: number;
}

/** The three things people come back for. */
const QUICK: Item[] = [
  { label: 'Liked', icon: 'heart-outline', href: '/liked' },
  { label: 'Saved', icon: 'bookmark-outline', href: '/my-wishlist' },
  { label: 'Recently Rented', icon: 'time-outline', href: '/recently-rented' },
];

const ITEMS: Item[] = [
  // Posting is reachable from the Feed and the Profile too; it is here
  // because the menu is where people look when they cannot find a thing.
  { label: 'Post or list something', icon: 'add-circle-outline', href: '/post-sheet' },
  { label: 'My Listings', icon: 'pricetags-outline', href: '/my-listings' },
  { label: 'Rental Requests', icon: 'mail-unread-outline', href: '/rental-requests' },
  { label: 'My Rentals', icon: 'calendar-outline', href: '/my-rentals' },
  // Messages is not here. It has its own tab in the bottom bar, and a
  // second door to the same room is just something else to scan past.
  { label: 'Activity', icon: 'notifications-outline', href: '/(tabs)/activity' },
  { label: 'Find Friends', icon: 'person-add-outline', href: '/find-friends' },
  { label: 'Invite Friends', icon: 'share-outline', href: '/invite-friends' },
  { label: 'Payouts & Payment Info', icon: 'card-outline', href: '/payouts' },
  { label: 'Safety', icon: 'shield-checkmark-outline', href: '/help' },
  { label: 'Help & Support', icon: 'help-circle-outline', href: '/help' },
  { label: 'Settings', icon: 'settings-outline', href: '/settings' },
];

export default function Menu() {
  const router = useRouter();
  // The badge moved with the row. What needs an answer is no longer
  // unread messages — that count lives on the Messages tab — but the
  // requests sitting on her pieces waiting for a yes or no.
  const lending = useMyBookings('lending');
  const waitingOnMe = lending.bookings.filter((b) => b.status === 'requested').length;
  const slide = useRef(new Animated.Value(-WIDTH)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [slide]);

  /** Slide out first, so it does not just vanish. */
  const close = (then?: () => void) => {
    Animated.timing(slide, {
      toValue: -WIDTH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      router.back();
      then?.();
    });
  };

  const go = (href: Href) => close(() => router.push(href));

  return (
    <View style={styles.backdrop}>
      {/* Tapping the dimmed area closes it, as a panel should. */}
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={() => close()}
      />

      <Animated.View style={[styles.panel, { transform: [{ translateX: slide }] }]}>
        <View style={styles.header}>
          <Logo size={28} lockup="below" />
          <IconButton name="close" onPress={() => close()} accessibilityLabel="Close menu" />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.quick}>
            {QUICK.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() => go(item.href)}
                style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}
              >
                <Icon name={item.icon} size={iconSize.md} />
                <Text variant="caption" tone="secondary" style={styles.quickLabel}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {ITEMS.map((raw) => {
            const item =
              raw.href === '/rental-requests' ? { ...raw, badge: waitingOnMe } : raw;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() => go(item.href)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Icon name={item.icon} size={iconSize.sm} tint={color.text.secondary} />
                <Text style={styles.rowLabel}>{item.label}</Text>
                {item.badge ? (
                  <View style={styles.badge}>
                    <Text variant="caption" tone="inverse">
                      {item.badge > 9 ? '9+' : item.badge}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            onPress={() => close(() => void signOut(auth))}
            style={({ pressed }) => [styles.row, styles.logOut, pressed && styles.pressed]}
          >
            <Icon name="log-out-outline" size={iconSize.sm} tint={color.text.secondary} />
            <Text style={styles.rowLabel}>Log out</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: 'row' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.scrim.behindPanel,
  },
  panel: {
    width: WIDTH,
    height: '100%',
    backgroundColor: color.surface.page,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: color.border.default,
    paddingTop: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  quick: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.default,
  },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    minHeight: controls.minTapTarget + 16,
  },
  quickLabel: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: controls.minTapTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
  pressed: { backgroundColor: color.surface.muted },
  rowLabel: { flex: 1 },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: color.surface.inverse,
  },
  logOut: { marginTop: spacing.lg, marginBottom: spacing.xxl },
});
