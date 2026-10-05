/**
 * The five-tab bar: Feed, Discover, Messages, Activity, Profile.
 *
 * Icons only. The labels were a word under every icon for five icons
 * everybody already recognises, and they cost a row of height on a
 * screen whose whole job is showing photographs. The titles stay set
 * because that is what a screen reader announces.
 */

import { Tabs } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, controls, iconSize, radius, spacing, type } from '@loane/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { useUnreadMessageCount } from '../../src/hooks/useMessaging';
import { SuspendedBanner } from '../../src/components/SuspendedBanner';
import { Icon, type IconName } from '../../src/components/Icon';

/**
 * A tab icon, with a chartreuse pill behind the one you are on.
 *
 * The accent is the PILL and not the glyph on purpose. #B5BF50 is a
 * light yellow-green: as an icon on a white bar it sits at roughly
 * 1.9:1 contrast, which is not a subtle look, it is an invisible one.
 * Behind a black glyph it reads instantly and keeps the rule that
 * chartreuse is always a background with black on top.
 */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Icon
        name={name}
        size={iconSize.tab}
        tint={focused ? color.accent.label : color.text.muted}
      />
    </View>
  );
}

/**
 * The Profile tab shows her own face.
 *
 * Her photo is the clearest possible label for "you" — it is what
 * Instagram does, and it is why nobody has to think about which tab
 * their own profile is. It comes from the live auth profile, so
 * changing her picture updates the tab straight away rather than on
 * the next launch.
 *
 * Falls back to the person glyph when she has no photo yet, which is
 * everybody on their first day.
 */
function TabAvatar({ focused }: { focused: boolean }) {
  const { profile } = useAuth();

  if (!profile?.photoUrl) {
    return <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} />;
  }

  return (
    // The ring is always drawn and only changes colour, so the icon
    // does not shift by two points every time she changes tab.
    <View style={[styles.avatarRing, focused && styles.avatarRingActive]}>
      <Image source={{ uri: profile.photoUrl }} style={styles.avatarImage} resizeMode="cover" />
    </View>
  );
}

export default function TabsLayout() {
  // Nobody gets a push notification until Phase 6, so the badge is the
  // only nudge that something needs an answer.
  const unread = useUnreadCount();
  const unreadMessages = useUnreadMessageCount();

  /**
   * The home indicator's height, which is 34 on a notched iPhone and 0 on
   * one with a home button.
   *
   * Setting an explicit `height` on tabBarStyle opts out of the padding
   * React Navigation would otherwise add for this, so the icons sat on
   * top of the indicator and looked cut off. Screen.tsx deliberately
   * leaves the bottom edge alone precisely so the bar can own it — it
   * just never did.
   */
  const insets = useSafeAreaInsets();

  return (
    <>
      <SuspendedBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.icon.default,
          tabBarInactiveTintColor: color.text.muted,
          tabBarStyle: [
            styles.bar,
            {
              height: controls.tabBarHeight + insets.bottom,
              paddingBottom: insets.bottom,
            },
          ],
          tabBarShowLabel: false,
          tabBarItemStyle: styles.barItem,
        }}
      >
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'chatbubble' : 'chatbubble-outline'} focused={focused} />
            ),
            tabBarBadge:
              unreadMessages > 0 ? (unreadMessages > 9 ? '9+' : unreadMessages) : undefined,
            tabBarBadgeStyle: styles.badge,
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'heart' : 'heart-outline'} focused={focused} />
            ),
            tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
            tabBarBadgeStyle: styles.badge,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabAvatar focused={focused} />,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.surface.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    // Height and bottom padding are applied in the component, where the
    // safe-area inset is known.
    //
    // With no label underneath, the icons need centring in the content
    // area rather than being pushed to the top of it.
    paddingTop: 8,
  },
  barItem: { paddingVertical: 4 },
  // Always drawn, only the colour changes, so the glyph never shifts by
  // a few points as you move between tabs.
  iconPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: { backgroundColor: color.accent.background },
  avatarRing: {
    width: iconSize.tab,
    height: iconSize.tab,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: color.surface.muted,
  },
  avatarRingActive: { borderColor: color.border.accent },
  avatarImage: { width: '100%', height: '100%', borderRadius: radius.pill },
  badge: {
    backgroundColor: color.accent.background,
    color: color.accent.label,
    fontSize: type.caption.size,
  },
});
