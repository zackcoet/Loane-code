/**
 * "Will this photo actually work?" — asked before we keep it.
 *
 * A body photo that fails never reaches Storage: the image goes to the
 * Cloud Function as base64, is checked, and is gone. Nothing is stored
 * to be rejected.
 *
 * IT FAILS OPEN. A missing key, a timeout, a bad reply — all of it
 * lets the photo through. This exists to save her a wasted try-on, not
 * to stand between her and the feature. The function is the same, and
 * says so at greater length.
 *
 * The check costs about $0.002 against $0.075 for a generation, so
 * catching one unusable photo pays for roughly forty checks.
 */

import { useCallback, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { checkPhoto } from '../firebase/callables';
import { compressPhoto, type PickedPhoto } from '../lib/photo';

/**
 * Smaller than we store. The check only needs to see what is in frame,
 * and every pixel is a token we pay for.
 */
const CHECK_MAX_EDGE = 1024;

export interface PhotoVerdict {
  ok: boolean;
  /** One specific sentence telling her what to change. Null when ok. */
  fix: string | null;
  /** True when it could not be checked and was let through anyway. */
  skipped: boolean;
}

export function usePhotoCheck() {
  const [checking, setChecking] = useState(false);

  const check = useCallback(
    async (photo: PickedPhoto, kind: 'body' | 'flat'): Promise<PhotoVerdict> => {
      setChecking(true);
      try {
        const small = await compressPhoto(photo, CHECK_MAX_EDGE);
        const imageBase64 = await FileSystem.readAsStringAsync(small.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const result = await checkPhoto({ kind, imageBase64, mediaType: 'image/jpeg' });
        return result.data;
      } catch {
        // Reading the file, the network, the call — anything. Her photo
        // is not the thing that went wrong, so it goes through.
        return { ok: true, fix: null, skipped: true };
      } finally {
        setChecking(false);
      }
    },
    [],
  );

  return { check, checking };
}
