/**
 * The "…" on a profile or a chat: report, or block.
 *
 * ONE PLACE, because the two screens must offer the same thing. A
 * student who can block from a profile but not from the chat where
 * somebody is actually messaging her has a safety feature that is
 * missing exactly where she needs it.
 *
 * Apple requires a way to block another user in any app where users
 * can contact each other. It is also just correct: reporting asks us
 * to act, and blocking lets her act herself, now, without waiting.
 *
 * BLOCKING IS CONFIRMED, UNBLOCKING IS NOT. Blocking hides them from
 * each other in both directions, which is a big change to make on a
 * mis-tap. Undoing it is in Settings → Blocked.
 */

import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { blockUser } from '../firebase/callables';
import { callableErrorMessage } from '../firebase/errors';

interface Options {
  uid: string;
  username: string;
  /** Opens the report sheet, which each screen already owns. */
  onReport: () => void;
  /** Called after a successful block, usually to leave the screen. */
  onBlocked?: () => void;
}

export function useReportOrBlock({ uid, username, onReport, onBlocked }: Options) {
  const [busy, setBusy] = useState(false);

  const confirmBlock = useCallback(() => {
    Alert.alert(
      `Block @${username}?`,
      "You won't see each other's posts, listings or messages, and she won't be told. You can undo this in Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void blockUser({ uid })
              .then(() => onBlocked?.())
              .catch((err) =>
                Alert.alert('Loane', callableErrorMessage(err, 'Could not block right now.')),
              )
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }, [uid, username, onBlocked]);

  const open = useCallback(() => {
    if (busy) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', `Report @${username}`, `Block @${username}`],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (index) => {
          if (index === 1) onReport();
          if (index === 2) confirmBlock();
        },
      );
    } else {
      Alert.alert(`@${username}`, undefined, [
        { text: 'Report', onPress: onReport },
        { text: 'Block', style: 'destructive', onPress: confirmBlock },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [busy, username, onReport, confirmBlock]);

  return { open, busy };
}
