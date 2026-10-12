/**
 * "Make it try-on ready" — the lender's side of try-on.
 *
 * One optional card on the listing form, and a guided camera behind
 * it. She lays the piece flat, we check it, cut the background out,
 * and show her exactly what a renter will see on herself.
 *
 * A MODAL RATHER THAN A ROUTE, deliberately. The result is an image,
 * and an image cannot travel in navigation params — a route would have
 * meant a draft store, a context or a global just to hand one photo
 * back to a form she never left. The camera opens over the form and
 * closes again.
 *
 * SHOWN FOR TOPS, DRESSES, OUTERWEAR AND BOTTOMS ONLY. Asking somebody
 * to photograph a handbag for a feature that cannot put a handbag on
 * anybody is asking for work that buys her nothing.
 *
 * WHAT IT COSTS US: about $0.002 for the check and $0.075 for the
 * cutout, and only when the check passes — so a photo of a clothes
 * rail costs a fifth of a cent to turn down. Once per listing, not
 * once per try-on.
 */

import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { color, controls, radius, spacing } from '@loane/shared';
import { Button } from './Button';
import { Icon } from './Icon';
import { LoaneLoader } from './LoaneLoader';
import { Text } from './Text';
import { prepareFlatPhoto } from '../firebase/callables';
import { compressPhoto, pickPhoto, type PickedPhoto } from '../lib/photo';

/** Small enough to stay cheap, big enough for FASHN to keep the detail. */
const SEND_MAX_EDGE = 1024;

type Stage = 'capture' | 'working' | 'failed' | 'preview';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The finished cutout, ready to attach to the listing. */
  onReady: (photo: PickedPhoto) => void;
}

export function MakeTryOnReady({ visible, onClose, onReady }: Props) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [stage, setStage] = useState<Stage>('capture');
  const [fix, setFix] = useState<string | null>(null);
  const [result, setResult] = useState<PickedPhoto | null>(null);
  const [usedOriginal, setUsedOriginal] = useState(false);

  const reset = () => {
    setStage('capture');
    setFix(null);
    setResult(null);
    setUsedOriginal(false);
  };

  const process = async (picked: PickedPhoto) => {
    setStage('working');
    setFix(null);
    try {
      const small = await compressPhoto(picked, SEND_MAX_EDGE);
      const imageBase64 = await FileSystem.readAsStringAsync(small.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const out = await prepareFlatPhoto({ imageBase64 });

      if (!out.data.ok) {
        setFix(out.data.fix ?? 'Try another photo of just this piece.');
        setStage('failed');
        return;
      }

      // A transparent PNG comes back. It is written to a cache file so
      // the form can treat it like any other picked photo.
      const path = `${FileSystem.cacheDirectory}flat-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(path, out.data.imageBase64 ?? imageBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setUsedOriginal(out.data.usedOriginal);
      setResult({ uri: path, width: small.width, height: small.height });
      setStage('preview');
    } catch {
      /*
        The network, the file, the call — anything. Her photo is not
        what went wrong, so it is kept and used as it is. She came here
        to list a garment, not to debug ours.
      */
      setUsedOriginal(true);
      setResult(picked);
      setStage('preview');
    }
  };

  const onShutter = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) {
      await process({ uri: photo.uri, width: photo.width, height: photo.height });
    }
  };

  const onPick = async () => {
    const picked = await pickPhoto('library', 'free');
    if (picked) await process(picked);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <View style={styles.screen}>
        <View style={styles.bar}>
          <Text variant="label" tone="heading">
            Make it try-on ready
          </Text>
          <Pressable
            onPress={() => {
              reset();
              onClose();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Icon name="close" size={22} tint={color.icon.default} />
          </Pressable>
        </View>

        {/* --- The stage ------------------------------------------------ */}
        <View style={styles.stage}>
          {stage === 'capture' ? (
            permission?.granted ? (
              <>
                <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
                {/*
                  A SIBLING of the camera, not a child: children of the
                  native camera view are not reliably laid out over the
                  preview, which is how the body camera shipped without
                  its outline.
                */}
                <View style={styles.guideLayer} pointerEvents="none">
                  <View style={styles.guide} />
                </View>
              </>
            ) : (
              <View style={styles.centre}>
                <Text variant="bodySmall" tone="secondary" uppercase={false} style={styles.centred}>
                  Loane needs your camera to photograph the piece.
                </Text>
              </View>
            )
          ) : stage === 'working' ? (
            <View style={styles.centre}>
              <LoaneLoader size={40} />
              <Text variant="bodySmall" tone="secondary" uppercase={false}>
                Checking and cutting it out…
              </Text>
            </View>
          ) : stage === 'failed' ? (
            <View style={styles.centre}>
              <Icon name="alert-circle-outline" size={28} tint={color.status.error} />
              <Text variant="bodySmall" uppercase={false} style={styles.centred}>
                {fix}
              </Text>
            </View>
          ) : (
            /* The cutout on white — exactly what a renter will see. */
            <View style={styles.preview}>
              {result ? (
                <Image source={{ uri: result.uri }} style={styles.previewImage} resizeMode="contain" />
              ) : null}
            </View>
          )}
        </View>

        {/* --- What to do about it -------------------------------------- */}
        <View style={styles.panel}>
          {stage === 'capture' ? (
            <>
              <Tip icon="albums-outline" text="Lay it flat on a plain white sheet" strong />
              <Tip icon="crop-outline" text="The whole piece in frame, nothing cropped" />
              <Tip icon="remove-circle-outline" text="One piece only — no shoes, no bags" />
              {permission?.granted ? (
                <Button label="Take photo" onPress={() => void onShutter()} />
              ) : (
                <Button label="Allow camera" onPress={() => void requestPermission()} />
              )}
              <Button label="Choose from library" variant="outline" onPress={() => void onPick()} />
            </>
          ) : stage === 'failed' ? (
            <>
              <Button label="Retake" onPress={reset} />
              <Button label="Choose another" variant="outline" onPress={() => void onPick()} />
            </>
          ) : stage === 'preview' ? (
            <>
              <Text variant="bodySmall" tone="heading" uppercase={false} style={styles.centred}>
                This is what renters will try on
              </Text>
              {usedOriginal ? (
                <Text variant="caption" tone="muted" uppercase={false} style={styles.centred}>
                  We couldn&apos;t cut the background out this time, so your photo is used as it
                  is. It still works.
                </Text>
              ) : null}
              <Button
                label="Looks good"
                onPress={() => {
                  if (result) onReady(result);
                  reset();
                  onClose();
                }}
              />
              <Button label="Retake" variant="outline" onPress={reset} />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Tip({ icon, text, strong }: { icon: string; text: string; strong?: boolean }) {
  return (
    <View style={styles.tip}>
      <Icon
        name={icon as never}
        size={16}
        tint={strong ? color.role.shared.background : color.icon.muted}
      />
      <Text
        variant="bodySmall"
        tone={strong ? 'heading' : 'secondary'}
        uppercase={false}
        style={strong ? styles.strong : undefined}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface.page },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: controls.headerHeight,
  },
  stage: { flex: 1, backgroundColor: color.text.primary, overflow: 'hidden' },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: color.surface.page,
  },
  centred: { textAlign: 'center' },
  guideLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guide: {
    width: '78%',
    height: '72%',
    borderWidth: 2,
    borderColor: color.surface.raised,
    borderRadius: radius.md,
    opacity: 0.8,
  },
  // White, because that is the background the cutout will sit on
  // everywhere else in the app.
  preview: { flex: 1, backgroundColor: color.surface.raised },
  previewImage: { width: '100%', height: '100%' },
  panel: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
    backgroundColor: color.surface.raised,
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  strong: { fontWeight: '600' },
});
