/**
 * The invite message and the share sheet that sends it.
 *
 * Shared by Invite Friends and the "Invite your roommates" step in Get
 * started, so the two can never drift into saying different things.
 * `surface` is where she shared from, for the `invite_shared` event.
 */

import { useCallback } from 'react';
import { Alert, Share } from 'react-native';
import { brand, type EventSurface } from '@loane/shared';
import { useAuth } from '../auth/AuthProvider';
import { useCampusName } from './useCampus';
import { logEvent } from '../analytics/events';

export function useInviteShare(surface: EventSurface, from?: string) {
  const { profile } = useAuth();
  const { name: campusName } = useCampusName(profile?.campusId);

  const message = `Come share closets with me on Loane — it's rentals from girls at ${
    campusName ?? 'our school'
  }. Rent something for gameday instead of buying it.\n\n${brand.website}`;

  const share = useCallback(async (): Promise<boolean> => {
    try {
      const result = await Share.share({ message });
      if (result.action === Share.sharedAction) {
        logEvent('invite_shared', {
          surface,
          targetType: null,
          targetId: null,
          ...(from ? { meta: { from } } : {}),
        });
        return true;
      }
    } catch {
      Alert.alert('Loane', 'Could not open the share sheet.');
    }
    return false;
  }, [message, surface, from]);

  return { message, share };
}
