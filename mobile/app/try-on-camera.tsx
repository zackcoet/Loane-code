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

import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { pickPhoto, uploadTryOnBodyPhoto, type PickedPhoto } from '../src/lib/photo';
import { usePhotoCheck, type PhotoVerdict } from '../src/hooks/usePhotoCheck';
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
  /**
   * Where to go once the photo is saved.
   *
   * Coming from Saved, "back" would be the camera's own caller and she
   * would have to find her way to her pieces again. Taking a photo is
   * a step on the way to something, never the thing itself.
   */
  const { next, pick } = useLocalSearchParams<{ next?: string; pick?: string }>();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [shot, setShot] = useState<PickedPhoto | null>(null);
  /**
   * Back by default: a full-body photo almost always means somebody
   * else holding the phone, and at arm's length a front camera cannot
   * get her feet in. She can flip if she is using a mirror or a stand.
   */
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  /** So the picker opens once, not on every render. */
  const askedLibrary = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * The verdict on the shot she is looking at. Checked the moment she
   * takes or picks one, so she is not asked to confirm a photo we are
   * about to reject.
   */
  const [verdict, setVerdict] = useState<PhotoVerdict | null>(null);
  const photoCheck = usePhotoCheck();

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

  const useShot = async (picked: PickedPhoto) => {
    setShot(picked);
    setConfirmed(false);
    setError(null);
    setVerdict(null);
    setVerdict(await photoCheck.check(picked, 'body'));
  };

  const onShutter = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) {
      await useShot({ uri: photo.uri, width: photo.width, height: photo.height });
    }
  };

  /** Her camera roll, for a full-body photo somebody already took. */
  const onPickFromLibrary = async () => {
    const picked = await pickPhoto('library', 'free');
    if (picked) await useShot(picked);
  };

  /*
    Arrived from "Choose from library": open the picker straight away.

    She comes through this screen rather than round it so the photo
    check and the "this is a photo of me" confirmation happen whichever
    way she chose a photo — a second path that skipped either would be
    a second path that quietly has no consent record.
  */
  useEffect(() => {
    if (pick !== 'library' || askedLibrary.current) return;
    askedLibrary.current = true;
    void onPickFromLibrary();
    // Once, on arrival.
  }, [pick]);

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
      if (next === 'saved') {
        router.replace({ pathname: '/try-on', params: { body: 'own', source: 'saved' } });
      } else {
        router.back();
      }
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
          <>
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} />
            {/*
              A SIBLING, not a child of CameraView.

              Children of the native camera view are not reliably laid
              out over the preview — on a real phone the outline simply
              did not appear, which is how this shipped without one.
              An absolutely positioned sibling is plain React Native
              layout and cannot be swallowed by the native view.

              A plain rounded rectangle rather than a body silhouette:
              a silhouette of one shape tells somebody who is not that
              shape that she is standing wrong.
            */}
            <View style={styles.outlineLayer} pointerEvents="none">
              <View style={styles.outline} />
              <Text
                variant="caption"
                tone="inverse"
                uppercase={false}
                style={styles.outlineHint}
              >
                Wear fitted clothes — loose clothing shows through
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.panel}>
        {shot ? (
          photoCheck.checking ? (
            <View style={styles.checking}>
              <LoaneLoader size={30} />
              <Text variant="bodySmall" tone="secondary" uppercase={false}>
                Checking your photo…
              </Text>
            </View>
          ) : verdict && !verdict.ok ? (
            /*
              A specific fix, not "invalid photo". She is told exactly
              what to change and given both ways to change it — the
              second one matters, because "retake" is no help when the
              good photo is already in her camera roll.
            */
            <>
              <View style={styles.verdictRow}>
                <Icon name="alert-circle-outline" size={20} tint={color.status.error} />
                <Text variant="bodySmall" uppercase={false} style={styles.verdictText}>
                  {verdict.fix}
                </Text>
              </View>
              <Button label="Retake" onPress={() => setShot(null)} />
              <Button
                label="Choose another"
                variant="outline"
                onPress={() => void onPickFromLibrary()}
              />
            </>
          ) : (
          <>
            {/* Said once, quietly, so "it worked" is not a dialog she
                has to dismiss. */}
            {verdict?.ok && !verdict.skipped ? (
              <View style={styles.verdictRow}>
                <Icon name="checkmark-circle" size={20} tint={color.role.shared.background} />
                <Text variant="bodySmall" tone="heading" uppercase={false}>
                  Looks great
                </Text>
              </View>
            ) : null}

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
          )
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
            {/* Next to the camera, not hidden behind it. A good
                full-body photo of her usually already exists. */}
            <Button
              label="Choose from library"
              variant="outline"
              onPress={() => void onPickFromLibrary()}
            />
            <Button
              label={facing === 'back' ? 'Use the front camera' : 'Use the back camera'}
              variant="text"
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: color.text.primary, overflow: 'hidden' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outlineLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineHint: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    textAlign: 'center',
    // Legible over whatever the camera is pointed at.
    textShadowColor: color.scrim.onPhoto,
    textShadowRadius: 6,
  },
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
  checking: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  verdictRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  verdictText: { flex: 1 },
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
