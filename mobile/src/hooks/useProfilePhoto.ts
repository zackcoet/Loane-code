/**
 * Changing your profile photo.
 *
 * Shared by the Edit Profile screen and by tapping your avatar on your
 * own profile, so the two cannot drift apart — there is one place that
 * knows how a profile photo is picked, shrunk, uploaded and saved.
 */

import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@loane/shared';
import { db } from '../firebase/config';
import { useAuth } from '../auth/AuthProvider';
import { pickPhoto, uploadProfilePhoto, type PhotoSource } from '../lib/photo';
import { logEvent } from '../analytics/events';

interface Options {
  /**
   * Called with the new URL instead of saving. The Edit Profile screen
   * uses this, because there the photo is part of a form she might
   * still cancel out of.
   */
  onPicked?: (url: string) => void;
}

export function useProfilePhoto({ onPicked }: Options = {}) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);

  const run = useCallback(
    async (source: PhotoSource) => {
      if (!profile) return;
      setUploading(true);
      try {
        const picked = await pickPhoto(source, 'square');
        if (!picked) return;

        const url = await uploadProfilePhoto(profile.uid, picked);

        if (onPicked) {
          onPicked(url);
        } else {
          // Tapped straight from the profile: save it there and then,
          // because there is no form around it to submit.
          await updateDoc(doc(db, COLLECTIONS.users, profile.uid), {
            photoUrl: url,
            updatedAt: serverTimestamp(),
          });
          logEvent('profile_edit', {
            surface: 'profile',
            targetType: 'user',
            targetId: profile.uid,
            meta: { field: 'photo' },
          });
        }
      } catch {
        Alert.alert('Loane', 'Could not upload that photo. Try again.');
      } finally {
        setUploading(false);
      }
    },
    [profile, onPicked],
  );

  /** Offers camera or library, then does the rest. */
  const change = useCallback(() => {
    if (uploading) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take a photo', 'Choose from library'], cancelButtonIndex: 0 },
        (index) => {
          if (index === 1) void run('camera');
          if (index === 2) void run('library');
        },
      );
    } else {
      Alert.alert('Profile photo', undefined, [
        { text: 'Take a photo', onPress: () => void run('camera') },
        { text: 'Choose from library', onPress: () => void run('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [run, uploading]);

  return { change, uploading };
}
