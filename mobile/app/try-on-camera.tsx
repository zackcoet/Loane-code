/**
 * The body photo camera.
 *
 * THE GUIDANCE IS THE FEATURE. Phase 0 found that a dress rendered over
 * a body wearing trousers leaves the trousers on — yellow joggers
 * poking out below the hem of a floral wrap dress. That is not a bug we
 * can fix in code, which is why "wear fitted clothes" is on the camera
 * and not in a help article nobody reads. It is the single
 * highest-value instruction on this screen.
 *
 * The outline is there for the same reason: a photo cropped at the
 * thigh or taken at an angle produces a worse result, and the cheapest
 * moment to fix that is before the shutter.
 *
 * "This is a photo of me" is NOT pre-ticked and is not buried in a
 * paragraph. We are about to hold a photograph of somebody's body; the
 * consent for that is a deliberate act or it is nothing.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, radius, spacing } from '@loane/shared';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { LoaneLoader } from '../src/components/LoaneLoader';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { uploadTryOnBodyPhoto, type PickedPhoto } from '../src/lib/photo';
import { setTryOnBodyPhoto } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { logEvent } from '../src/analytics/events';

/** In the order they matter. Fitted clothes is not a footnote. */
const TIPS: { icon: string; text: string; strong?: boolean }[] = [
  { icon: 'person-outline', text: 'Stand inside the outline, head to feet' },
  {
    icon: 'shirt-outline',
    text: 'Wear fitted clothes — loose clothing shows through',
    strong: true,
  },
  { icon: 'resize-outline', text: 'Arms and legs slightly apart' },
  { icon: 'square-outline', text: 'Plain wall behind you, good light' },
];

export default function TryOnCamera() {
  const router = useRouter();
  const { profile } = useAuth();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [shot, setShot] = useState<PickedPhoto | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!permission) {
    return (
      <Screen flush>
        <Header title="Your photo" onBack={() => router.back()} />
        <View style={styles.centre}>
          <LoaneLoader size={34} />
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen flush>
        <Header title="Your photo" onBack={() => router.back()} />
        <EmptyState
          title="Loane needs your camera"
          body="The photo is used to show clothes on you. It stays private to your account — no other student and no admin can see it."
          actionLabel="Allow camera"
          onAction={() => void requestPermission()}
        />
      </Screen>
    );
  }

  const onShutter = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) setShot({ uri: photo.uri, width: photo.width, height: photo.height });
  };

  const onUse = async () => {
    if (!profile || !shot) return;
    setBusy(true);
    setError(null);
    try {
      const path = await uploadTryOnBodyPhoto(profile.uid, shot);
      // The confirmation travels with the photo. The server refuses to
      // record one without it.
      await setTryOnBodyPhoto({ path, confirmed: true });
      logEvent('tryon_body_photo_set', { surface: 'tryon' });
      router.back();
    } catch (err) {
      setError(callableErrorMessage(err, 'Could not save that photo. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen flush>
      <Header title="Your photo" onBack={() => router.back()} />

      <View style={styles.stage}>
        {shot ? (
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back">
            {/* The outline. A plain rounded rectangle rather than a body
                silhouette: a silhouette of one shape tells somebody who
                is not that shape that she is standing wrong. */}
            <View style={styles.outlineLayer} pointerEvents="none">
              <View style={styles.outline} />
            </View>
          </CameraView>
        )}
      </View>

      <View style={styles.panel}>
        {shot ? (
          <>
            <Pressable
              onPress={() => setConfirmed((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmed }}
              style={styles.confirmRow}
            >
              <View style={[styles.box, confirmed && styles.boxOn]}>
                {confirmed ? <Icon name="checkmark" size={14} tint={color.text.inverse} /> : null}
              </View>
              <Text variant="bodySmall" uppercase={false} style={styles.confirmLabel}>
                This is a photo of me
              </Text>
            </Pressable>
            <Text variant="caption" tone="muted" uppercase={false}>
              Uploading a photo of anyone else is not allowed.
            </Text>

            {error ? (
              <Text variant="caption" tone="error" uppercase={false}>
                {error}
              </Text>
            ) : null}

            <Button
              label="Use this photo"
              onPress={() => void onUse()}
              loading={busy}
              disabled={!confirmed}
            />
            <Button label="Retake" variant="text" onPress={() => setShot(null)} />
          </>
        ) : (
          <>
            {TIPS.map((tip) => (
              <View key={tip.text} style={styles.tip}>
                <Icon
                  name={tip.icon as never}
                  size={16}
                  tint={tip.strong ? color.role.shared.background : color.icon.muted}
                />
                <Text
                  variant="bodySmall"
                  tone={tip.strong ? 'heading' : 'secondary'}
                  uppercase={false}
                  style={tip.strong ? styles.strong : undefined}
                >
                  {tip.text}
                </Text>
              </View>
            ))}
            <Button label="Take photo" onPress={() => void onShutter()} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: color.text.primary, overflow: 'hidden' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outlineLayer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outline: {
    width: '58%',
    height: '86%',
    borderWidth: 2,
    borderColor: color.surface.raised,
    borderRadius: radius.card,
    opacity: 0.8,
  },
  panel: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    backgroundColor: color.surface.raised,
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  strong: { fontWeight: '600' },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: controls.minTapTarget,
  },
  confirmLabel: { fontWeight: '600' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: color.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: color.role.shared.background,
    borderColor: color.role.shared.border,
  },
});
