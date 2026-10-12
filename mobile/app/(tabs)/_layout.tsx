/**
 * THE RULE FOR THIS BAR, AND THE ONLY ONE:
 *
 *   WE DO NOT SET ITS HEIGHT OR ITS BOTTOM PADDING. EVER.
 *
 * React Navigation sizes the bar for the device and centres the icons
 * in the space above the home indicator. It is the only thing in this
 * file that knows the real inset on the real phone, and every time
 * somebody has "fixed" this bar by supplying a number instead, it has
 * broken on a device they were not holding.
 *
 * The history, so nobody repeats it:
 *
 *   height: 92 flat          crowded the home indicator
 *   computed height          pushed the icons off screen entirely
 *   paddingTop               shoved them into the indicator band
 *   height: 64, padding 0    made 64 the WHOLE bar including the
 *                            indicator, so the glyphs were drawn
 *                            behind the padding and sliced
 *   height: 72 + item height the bar towered, icons pinned not centred
 *   height: 56 + raw inset   nothing under the icons on a phone
 *                            reporting no inset
 *   max(inset, 12)           icons too high, empty band underneath
 *
 * Six attempts, all the same mistake in different clothes: supplying a
 * number for something the framework already knows. This file now sets
 * the background and the hairline and NOTHING ELSE about size.
 *
 * If the bar ever looks wrong again, the fix is not a number here.
 * Check whether a SCREEN is adding bottom inset — Screen.tsx and
 * FilterSheet.tsx both pass edges={['top','left','right']} precisely so
 * they do not, and that is the invariant to protect.
 *
 * ---
 *
 * The bar: Feed, Discover, +, Activity, Profile.
 *
 * The + is NOT a tab. It is a raised cherry button in the middle that
 * opens the post sheet, which is where Ella wanted it and where every
 * app of this shape puts the thing it most wants tapped. Messages moved
 * out to the Feed header, Instagram-style, to free the slot.
 *
 * Icons only. The labels were a word under every icon for five icons
 * everybody already recognises, and they cost a row of height on a
 * screen whose whole job is showing photographs. The titles stay set
 * because that is what a screen reader announces.
 */

import { Tabs } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { color, fontFamilyFor, iconSize, radius, type } from '@loane/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { SuspendedBanner } from '../../src/components/SuspendedBanner';
import { Icon, type IconName } from '../../src/components/Icon';


const POST_BUTTON_SIZE = 60;

/**
 * A tab icon. Black when you are on it, grey when you are not.
 *
 * No accent here. A chartreuse pill behind the active glyph was tried
 * and reverted: it made the icon row taller than the bar, which pushed
 * every glyph out of the visible area, and a filled selected state is
 * louder than this bar should be. Selection is weight, not colour.
 */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <Icon name={name} size={iconSize.tab} tint={focused ? color.icon.default : color.text.muted} />
  );
}

/**
 * The raised + in the middle of the bar.
 *
 * Cherry and lifted off the bar, because putting something on Loane is
 * the action the whole app exists to collect. It sits proud of the bar
 * rather than inside it, which is why the negative margin is here: the
 * bar is only 49pt tall and the button is 56.
 */
function PostButton() {
  return (
    <View style={styles.postButton}>
      <Icon name="add" size={30} tint={color.role.renter.label} />
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

  return (
    <>
      <SuspendedBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.icon.default,
          tabBarInactiveTintColor: color.text.muted,
          // No height, no padding. See the rule at the top of this file.
          tabBarStyle: styles.bar,
          tabBarShowLabel: false,
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
        {/*
          The middle slot. Not a destination — tapping it opens the post
          sheet and leaves you where you were, so `listeners` cancels the
          navigation the tab would otherwise do.

          It still has to BE a screen for the slot to exist in the bar at
          all; `messages` is the route behind it, which is also where the
          header chat button goes, so the two never disagree.
        */}
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Post',
            tabBarIcon: () => <PostButton />,
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('post-sheet' as never);
            },
          })}
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
  /**
   * Colour, the hairline, and overflow. NOT size — see the rule at the
   * top of this file.
   *
   * overflow: visible so the raised + sits proud of the bar instead of
   * being clipped at its top edge.
   */
  bar: {
    backgroundColor: color.surface.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    overflow: 'visible',
  },
  /*
    NO tabBarItemStyle. Forcing the item to the row height pinned the
    icons instead of letting React Navigation centre them in the space
    above the home indicator, which is the one part of this it has
    always got right on its own.
  */
  postButton: {
    width: POST_BUTTON_SIZE,
    height: POST_BUTTON_SIZE,
    borderRadius: radius.pill,
    backgroundColor: color.role.renter.background,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifts it proud of the tab row.
    marginTop: -26,
    shadowColor: color.role.renter.background,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  avatarRing: {
    width: iconSize.tab,
    height: iconSize.tab,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: color.surface.muted,
  },
  avatarRingActive: { borderColor: color.icon.default },
  avatarImage: { width: '100%', height: '100%', borderRadius: radius.pill },
  badge: {
    fontFamily: fontFamilyFor('500'),
    backgroundColor: color.role.shared.background,
    color: color.role.shared.label,
    fontSize: type.caption.size,
  },
});
