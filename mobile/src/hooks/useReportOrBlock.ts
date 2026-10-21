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
 * MUTE sits between the two: it only hides her looks from your feed,
 * changes nothing for her, and is undone from the same menu, so it
 * needs no confirm step.
 *
 * BLOCKING IS CONFIRMED, UNBLOCKING IS NOT. Blocking hides them from
 * each other in both directions, which is a big change to make on a
 * mis-tap. Undoing it is in Settings → Blocked.
 */

import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { blockUser } from '../firebase/callables';
import { callableErrorMessage } from '../firebase/errors';
import { useAuth } from '../auth/AuthProvider';
import { setUserMuted, useMutedUids } from './useMuted';

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
  const { profile } = useAuth();
  const { uids: mutedUids } = useMutedUids();
  const isMuted = mutedUids.has(uid);
  // Never offered on herself, or before we know who "her" is.
  const canMute = !!profile && !!uid && uid !== profile.uid;

  const toggleMute = useCallback(() => {
    if (!profile || !uid) return;
    const next = !isMuted;
    void setUserMuted(profile.uid, uid, next)
      .then(() =>
        Alert.alert(
          next ? `Muted @${username}` : `Unmuted @${username}`,
          next
            ? "Her looks won't show in your feed. She won't be told, and you can still visit her closet."
            : 'Her looks will show in your feed again.',
        ),
      )
      .catch(() => Alert.alert('Loane', 'Could not change that right now. Try again.'));
  }, [profile, uid, username, isMuted]);

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

    const muteLabel = isMuted ? `Unmute @${username}` : `Mute @${username}`;
    if (Platform.OS === 'ios') {
      const options = canMute
        ? ['Cancel', muteLabel, `Report @${username}`, `Block @${username}`]
        : ['Cancel', `Report @${username}`, `Block @${username}`];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: options.length - 1 },
        (index) => {
          const picked = options[index];
          if (picked === muteLabel) toggleMute();
          else if (picked === `Report @${username}`) onReport();
          else if (picked === `Block @${username}`) confirmBlock();
        },
      );
    } else {
      Alert.alert(`@${username}`, undefined, [
        ...(canMute ? [{ text: isMuted ? 'Unmute' : 'Mute', onPress: toggleMute }] : []),
        { text: 'Report', onPress: onReport },
        { text: 'Block', style: 'destructive' as const, onPress: confirmBlock },
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }, [busy, username, onReport, confirmBlock, canMute, isMuted, toggleMute]);

  return { open, busy };
}
