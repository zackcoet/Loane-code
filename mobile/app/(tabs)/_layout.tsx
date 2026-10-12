/**
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, fontFamilyFor, iconSize, radius, type } from '@loane/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { useUnreadCount } from '../../src/hooks/useNotifications';
import { SuspendedBanner } from '../../src/components/SuspendedBanner';
import { Icon, type IconName } from '../../src/components/Icon';

/**
 * The icon row, ABOVE the home indicator — not including it.
 *
 * The bar's real height is this plus the device's bottom inset. The
 * previous version set `height: 64` flat with `paddingBottom: 0`,
 * which made 64 the WHOLE bar on a phone with a home indicator: the
 * indicator area ate into the same 64, the row got what was left, and
 * the glyphs were clipped by the padding they were sitting behind.
 *
 * 72 rather than 64 because Zack asked for more room and the icons are
 * 33pt — 64 left eleven points above and below before any inset.
 */
const TAB_BAR_ROW_HEIGHT = 72;
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
  /*
    The home indicator's height, from the device rather than guessed.

    Every hard-coded version of this bar was wrong on some phone: 92
    crowded the indicator, a computed height clipped the icons off
    screen, a paddingTop pushed them into the indicator band. The inset
    is the number iOS actually reserves, so the row sits ON TOP of it
    instead of sharing it.
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
              // The row, PLUS the indicator — not the row squeezed into
              // the space the indicator left.
              height: TAB_BAR_ROW_HEIGHT + insets.bottom,
              paddingBottom: insets.bottom,
              paddingTop: 0,
            },
          ],
          tabBarItemStyle: styles.item,
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
   * Colour and the hairline only. The HEIGHT is set per-device in
   * screenOptions, from the safe-area inset.
   *
   * Every version of this bar that guessed at numbers was wrong on some
   * phone. A hard-coded 92 crowded the home indicator. A computed
   * height clipped the icons off the screen entirely. A paddingTop
   * pushed them down into the indicator band so they looked cut short.
   * The last one set height: 64 with paddingBottom: 0, which made 64
   * the whole bar INCLUDING the indicator area — so the icons were
   * drawn behind the padding and sliced.
   *
   * The rule that actually works: the row gets a fixed height of its
   * own, the indicator gets its real inset as padding underneath, and
   * the bar is the two added together.
   *
   * `overflow: visible` so the raised + can sit proud of the bar
   * instead of being cut off at the top edge.
   */
  bar: {
    backgroundColor: color.surface.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    overflow: 'visible',
  },
  /*
    No translateY any more. The old -4 lift was compensating for the
    squeeze above; once the row has its own height the icons centre
    themselves, and lifting them again just moves the clipping to the
    top edge.
  */
  item: { height: TAB_BAR_ROW_HEIGHT, paddingVertical: 0 },
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
