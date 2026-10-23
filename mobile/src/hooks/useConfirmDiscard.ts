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

interface Options {
  /** Defaults to "Discard changes?" — right for an edit screen. */
  title?: string;
  message?: string;
  /**
   * Checked at the moment she leaves. True lets her go without asking —
   * for when another screen finished the job (the look was shared) and
   * this one is being cleared away with the rest of the flow.
   */
  canLeave?: () => boolean;
}

const DEFAULT_TITLE = 'Discard changes?';
const DEFAULT_MESSAGE = "If you go back now, your changes won't be saved.";

export function useConfirmDiscard(dirty: boolean, options: Options = {}) {
  const navigation = useNavigation();
  /** Set by a successful save, so leaving afterwards is not questioned. */
  const allowed = useRef(false);
  // Held in a ref so a new options object each render does not
  // re-register the listener.
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (allowed.current || opts.current.canLeave?.()) return;
      e.preventDefault();
      const { title = DEFAULT_TITLE, message = DEFAULT_MESSAGE } = opts.current;
      Alert.alert(title, message, [
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
