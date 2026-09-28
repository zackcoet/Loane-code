/**
 * The five-tab bar: Feed, Discover, Messages, Activity, Profile.
 */

import { Tabs } from 'expo-router';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { useUnreadMessageCount } from '../../src/hooks/useMessaging';
import { SuspendedBanner } from '../../src/components/SuspendedBanner';
import { StyleSheet } from 'react-native';
import { color, controls, iconSize, type } from '@loane/shared';
import { Icon, type IconName } from '../../src/components/Icon';

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <Icon name={name} size={iconSize.lg} tint={focused ? color.icon.default : color.text.muted} />
  );
}

export default function TabsLayout() {
  // Nobody gets a push notification until Phase 6, so the badge is the
  // only nudge that something needs an answer.
  const unread = useUnreadCount();
  const unreadMessages = useUnreadMessageCount();

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
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'chatbubble' : 'chatbubble-outline'} focused={focused} />,
            tabBarBadge: unreadMessages > 0 ? (unreadMessages > 9 ? '9+' : unreadMessages) : undefined,
            tabBarBadgeStyle: styles.badge,
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'heart' : 'heart-outline'} focused={focused} />,
            tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
            tabBarBadgeStyle: styles.badge,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} />,
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
  badge: {
    backgroundColor: color.status.error,
    color: color.text.inverse,
    fontSize: type.caption.size,
  },
});
