import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { controls, spacing } from '@loane/shared';

export function useKeyboardPadding(extra = controls.buttonHeight + spacing.lg) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboardHeight > 0 ? keyboardHeight + extra : 0;
}
