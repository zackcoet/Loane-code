/**
 * Choosing a body: her own photo, or one of the models.
 *
 * THE MODELS ARE THE POINT OF THIS SCREEN, so they get the room. They
 * are shown whole, head to toe, side by side — a student picking a
 * body needs to see the body, and the first version of this cropped
 * them to a face at full width, which showed neither.
 *
 * `contain`, not `cover`. These are full-length photographs with the
 * subject centred; cropping them to fill a card throws away the legs,
 * which is exactly the part she is judging. The letterboxing sits on
 * cream so it reads as a frame rather than a mistake.
 *
 * Her own photo is one line and three buttons. It is the thing most
 * students will already have decided about, and it does not need a
 * card explaining itself every time she opens this.
 *
 * EVERYTHING FITS ON ONE SCREEN. No scroll view: a chooser you have to
 * scroll is a chooser where half the options are invisible.
 *
 * Presets exist for two reasons and only one is accessibility. A
 * student who does not want a photograph of her own body in an app
 * should still get to see what a dress looks like on a person — and a
 * preset result is cached across the whole campus, so it is also the
 * version that costs almost nothing.
 */

import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import {
  TRYON_PRESETS,
  TRYON_PRESET_LABELS,
  color,
  radius,
  spacing,
  type PresetId,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useTryOnBody } from '../src/hooks/useTryOn';
import femalePreset from '../assets/tryon-presets/female.jpg';
import malePreset from '../assets/tryon-presets/male.jpg';

/**
 * The preset images, bundled.
 *
 * ADDING A PRESET IS A LINE HERE, A LINE IN TRYON_PRESETS, AND THE
 * IMAGE. Nothing else in the app changes — the cards, the cache and
 * the Cloud Function all read the list.
 *
 * Imported statically, one per preset: React Native's bundler resolves
 * asset paths at build time, so a path built from a variable would not
 * be bundled at all.
 */
const PRESET_IMAGES: Record<PresetId, ImageSourcePropType> = {
  female: femalePreset,
  male: malePreset,
};

/**
 * Long enough to see the check land, short enough not to feel like a
 * wait. Selecting and then vanishing in the same frame leaves her
 * unsure which one she tapped.
 */
const SELECTION_BEAT_MS = 160;

export default function TryOnBody() {
  const router = useRouter();
  const body = useTryOnBody();
  const [chosen, setChosen] = useState<PresetId | null>(null);
  /*
    Whatever she was trying to do before she was asked to pick a body.

    She taps "Try this look on", has no photo yet, is sent here — and
    has to end up back at that look rather than in an empty dressing
    room. The detour carries its own context.
  */
  const params = useLocalSearchParams<{ listings?: string; source?: string }>();
  const carried = {
    ...(params.listings ? { listings: params.listings } : {}),
    ...(params.source ? { source: params.source } : {}),
  };

  const choosePreset = (id: PresetId) => {
    setChosen(id);
    setTimeout(() => {
      router.replace({ pathname: '/try-on', params: { ...carried, body: 'preset', preset: id } });
    }, SELECTION_BEAT_MS);
  };

  return (
    <Screen flush>
      <Header title="Choose a body" onBack={() => router.back()} />

      <View style={styles.content}>
        {/* --- The models, given the room ---------------------------- */}
        <Text variant="label">Use a model</Text>
        <Text variant="caption" tone="muted" uppercase={false} style={styles.hint}>
          Computer-generated — they are not real people. Everyone shares these, so trying a piece
          on a model is usually instant.
        </Text>

        <View style={styles.presets}>
          {TRYON_PRESETS.map((id) => (
            <PresetCard
              key={id}
              id={id}
              selected={chosen === id}
              onPress={() => choosePreset(id)}
            />
          ))}
        </View>

        {/* --- Her own photo, compact -------------------------------- */}
        <View style={styles.mine}>
          <Text variant="label">Or use your own photo</Text>
          <Text variant="caption" tone="muted" uppercase={false}>
            {body.hasPhoto
              ? 'Saved and private to you. No other student and no admin can see it.'
              : 'Private to you. Nobody else can see it, and you can delete it in one tap.'}
          </Text>

          <View style={styles.mineActions}>
            {body.hasPhoto ? (
              <Button
                label="Use my photo"
                onPress={() =>
                  router.replace({ pathname: '/try-on', params: { ...carried, body: 'own' } })
                }
                style={styles.grow}
              />
            ) : null}
            <Button
              label={body.hasPhoto ? 'Retake' : 'Take my photo'}
              variant={body.hasPhoto ? 'outline' : undefined}
              onPress={() => router.push({ pathname: '/try-on-camera', params: carried })}
              style={styles.grow}
            />
            {/* The same screen, opening the picker on arrival — so the
                photo check and the "this is me" confirmation still
                happen whichever way she comes in. */}
            <Button
              label="Choose from library"
              variant="outline"
              onPress={() =>
                router.push({ pathname: '/try-on-camera', params: { ...carried, pick: 'library' } })
              }
              style={styles.grow}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

function PresetCard({
  id,
  selected,
  onPress,
}: {
  id: PresetId;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Use the ${TRYON_PRESET_LABELS[id]} model`}
      style={({ pressed }) => [styles.preset, pressed && styles.pressed]}
    >
      <View style={[styles.presetFrame, selected && styles.presetFrameOn]}>
        <Image source={PRESET_IMAGES[id]} style={styles.presetImage} resizeMode="contain" />
        {selected ? (
          <View style={styles.check}>
            <Icon name="checkmark" size={14} tint={color.text.inverse} />
          </View>
        ) : null}
      </View>
      <Text variant="caption" tone={selected ? 'heading' : 'secondary'} style={styles.presetLabel}>
        {TRYON_PRESET_LABELS[id]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.md, gap: spacing.xs },
  hint: { marginBottom: spacing.sm },
  // The models take whatever height is left once the compact block
  // below has had its share — which is what keeps this on one screen.
  presets: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  preset: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.7 },
  presetFrame: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface.section,
    borderWidth: 2,
    // Transparent rather than absent, so selecting does not resize the
    // card by two pixels.
    borderColor: 'transparent',
  },
  presetFrameOn: { borderColor: color.role.shared.background },
  presetImage: { width: '100%', height: '100%' },
  presetLabel: { textAlign: 'center' },
  check: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.role.shared.background,
  },
  mine: { gap: spacing.xs, paddingTop: spacing.md },
  mineActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  grow: { flex: 1 },
});
