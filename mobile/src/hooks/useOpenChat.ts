/**
 * "Message her" — from a profile, a listing, or a rental.
 *
 * All three land in the same thread, because a conversation's id is the
 * two uids sorted. She should never have to wonder which chat the other
 * person meant.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { openConversation } from '../firebase/callables';
import { callableErrorMessage } from '../firebase/errors';

export function useOpenChat() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const open = useCallback(
    async (withUid: string, context?: { listingId?: string; bookingId?: string }) => {
      if (opening) return;
      setOpening(true);
      try {
        const result = await openConversation({ withUid, ...context });
        router.push({ pathname: '/chat/[id]', params: { id: result.data.conversationId } });
      } catch (err) {
        Alert.alert('Loane', callableErrorMessage(err, 'Could not open that chat.'));
      } finally {
        setOpening(false);
      }
    },
    [router, opening],
  );

  return { open, opening };
}
