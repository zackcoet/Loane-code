/**
 * The two buttons at the top right of every main screen.
 *
 *   heart   Closet Crushes, the things she has saved
 *   search  Discover
 *
 * ONE COMPONENT, SO THEY CANNOT DRIFT. Ella's note was that search
 * moved depending on which screen you were on, which makes you look
 * for it every time instead of reaching for it. The only way two
 * screens stay in the same place is if there is one piece of code
 * putting them there.
 *
 * ORDER IS FIXED: heart then search, so search is always the outermost
 * icon and lands under the thumb in the same spot on every screen.
 *
 * WHERE SEARCH IS LEFT OUT, and why it is a prop rather than each
 * screen deciding:
 *
 *   Discover    is search. A search button on the search screen points
 *               at the screen you are already looking at.
 *
 * And where neither appears at all, which is every screen that is not
 * a main one: sign-up, the code screen, checkout and anything else
 * somebody is halfway through. A search icon there is an invitation to
 * abandon what she is doing, and on the code screen it is a way out of
 * a step she has to finish.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@loane/shared';
import { IconButton } from './IconButton';
import { WalkthroughTarget } from './WalkthroughTargets';

interface Props {
  /**
   * Leave search out. Only Discover does this, and only because it is
   * the search screen.
   */
  hideSearch?: boolean;
}

export function HeaderActions({ hideSearch = false }: Props) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <WalkthroughTarget target="crushes">
        <IconButton
          name="heart-outline"
          onPress={() => router.push('/my-wishlist')}
          accessibilityLabel="Closet Crushes"
        />
      </WalkthroughTarget>
      {hideSearch ? null : (
        <WalkthroughTarget target="search">
          <IconButton
            name="search-outline"
            onPress={() => router.push('/(tabs)/discover')}
            accessibilityLabel="Search closets"
          />
        </WalkthroughTarget>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
