/**
 * "Discard changes?" when she leaves a form with unsaved edits.
 *
 * Instagram asks before throwing away an edited profile or caption, and
 * so do we: a swipe back on iPhone is easy to do by accident, and losing
 * a carefully written bio or piece description to it feels like the app
 * ate her work.
 *
 * Catches every way of leaving — the back arrow, the iPhone edge swipe,
 * Android's back button — because they all remove the screen, and
 * `beforeRemove` fires for each. Saving calls `allowLeave()` first so
 * the save's own `router.back()` goes straight through.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from 'expo-router';

export function useConfirmDiscard(dirty: boolean) {
  const navigation = useNavigation();
  /** Set by a successful save, so leaving afterwards is not questioned. */
  const allowed = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (allowed.current) return;
      e.preventDefault();
      Alert.alert('Discard changes?', "If you go back now, your changes won't be saved.", [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            allowed.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
  }, [navigation, dirty]);

  /** Call right before leaving on purpose (after a save). */
  const allowLeave = useCallback(() => {
    allowed.current = true;
  }, []);

  return { allowLeave };
}
