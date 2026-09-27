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
import { StyleSheet, Text, View } from 'react-native';
import { colors, controls, icons, typography } from '@loane/shared';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, { color: focused ? colors.black : colors.textMuted }]}>{glyph}</Text>
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.black,
        tabBarInactiveTintColor: colors.textMuted,
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
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    height: controls.tabBarHeight,
    paddingTop: 10,
  },
  barLabel: {
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    letterSpacing: typography.caption.letterSpacing,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  barItem: { paddingVertical: 4 },
  icon: {
    fontSize: icons.lg,
    lineHeight: icons.lg * 1.15,
    textAlign: 'center',
  },
  plus: {
    width: controls.tabBarPlus,
    height: controls.tabBarPlus,
    borderRadius: controls.tabBarPlus / 2,
    borderWidth: 1.5,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusGlyph: {
    fontSize: 26,
    lineHeight: 30,
    color: colors.black,
    fontWeight: '300',
  },
});
