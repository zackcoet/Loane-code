/**
 * The five-tab bar: Feed, Discover, Post (+), Activity, Profile.
 *
 * The middle + is not a tab — tapping it opens a sheet asking "Post a Look"
 * or "Add to My Closet", exactly as in the mockups. We intercept its press
 * and route to a modal instead of switching tabs.
 *
 * Icons are drawn with text glyphs for now so we are not blocked on an
 * icon export. TODO-PHASE1: swap in the real icon set.
 */

import { Tabs, useRouter } from 'expo-router';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { useUnreadMessageCount } from '../../src/hooks/useMessaging';
import { SuspendedBanner } from '../../src/components/SuspendedBanner';
import { StyleSheet, Text, View } from 'react-native';
import { color, controls, iconSize, type } from '@loane/shared';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, { color: focused ? color.icon.default : color.text.muted }]}>
      {glyph}
    </Text>
  );
}

function PlusButton() {
  return (
    <View style={styles.plus}>
      <Text style={styles.plusGlyph}>+</Text>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  // Nobody gets a push notification until Phase 6, so the badge is the
  // only nudge that something needs an answer.
  const unread = useUnreadCount();
  // Messages live behind the menu, not a tab, so their badge rides on
  // Activity too — otherwise an unread message is invisible.
  const unreadMessages = useUnreadMessageCount();
  const totalUnread = unread + unreadMessages;

  return (
    <>
      <SuspendedBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.icon.default,
          tabBarInactiveTintColor: color.text.muted,
          tabBarStyle: styles.bar,
          tabBarLabelStyle: styles.barLabel,
          tabBarItemStyle: styles.barItem,
        }}
      >
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            tabBarIcon: ({ focused }) => <TabIcon glyph="⌂" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused }) => <TabIcon glyph="⌕" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="post"
          options={{
            title: '',
            tabBarIcon: () => <PlusButton />,
          }}
          listeners={{
            // Not a real tab: open the "what do you want to share?" sheet.
            tabPress: (event) => {
              event.preventDefault();
              router.push('/post-sheet');
            },
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ focused }) => <TabIcon glyph="♡" focused={focused} />,
            tabBarBadge: totalUnread > 0 ? (totalUnread > 9 ? '9+' : totalUnread) : undefined,
            tabBarBadgeStyle: styles.badge,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabIcon glyph="◯" focused={focused} />,
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
    height: controls.tabBarHeight,
    paddingTop: 10,
  },
  barLabel: {
    fontSize: type.caption.size,
    lineHeight: type.caption.lineHeight,
    letterSpacing: type.caption.letterSpacing,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  barItem: { paddingVertical: 4 },
  icon: {
    fontSize: iconSize.lg,
    lineHeight: iconSize.lg * 1.15,
    textAlign: 'center',
  },
  plus: {
    width: controls.tabBarPlus,
    height: controls.tabBarPlus,
    borderRadius: controls.tabBarPlus / 2,
    borderWidth: 1.5,
    borderColor: color.border.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: color.status.error,
    color: color.text.inverse,
    fontSize: type.caption.size,
  },
  plusGlyph: {
    fontSize: iconSize.md,
    lineHeight: 30,
    color: color.icon.default,
    fontWeight: '300',
  },
});
