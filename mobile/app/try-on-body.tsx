/**
 * Choosing a body: one of the presets, or her own photo.
 *
 * The presets are here for two reasons, and only one of them is
 * accessibility. A student who does not want to put a photograph of her
 * own body into an app should still get to see what a dress looks like
 * on a person — and because a preset result is cached across the whole
 * campus, it is also the version that costs almost nothing. See
 * docs/decisions.md.
 *
 * Labelled by build only: Petite, Medium, Curve. Never a number, never
 * a name. They are not characters and should not be given one.
 */

import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  TRYON_PRESETS,
  TRYON_PRESET_LABELS,
  color,
  controls,
  radius,
  spacing,
  type PresetId,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useTryOnBody } from '../src/hooks/useTryOn';

export default function TryOnBody() {
  const router = useRouter();
  const body = useTryOnBody();

  return (
    <Screen flush>
      <Header title="Choose a body" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="label">Your own photo</Text>

        {body.hasPhoto ? (
          <Card style={styles.mine}>
            <View style={styles.mineRow}>
              <Icon name="checkmark-circle" size={22} tint={color.role.shared.background} />
              <View style={styles.mineText}>
                <Text variant="bodySmall" uppercase={false} style={styles.strong}>
                  Your photo is saved
                </Text>
                <Text variant="caption" tone="muted" uppercase={false}>
                  Private to you. No other student and no admin can see it.
                </Text>
              </View>
            </View>
            <View style={styles.mineActions}>
              <Button
                label="Use my photo"
                onPress={() => router.replace({ pathname: '/try-on', params: { body: 'own' } })}
                style={styles.grow}
              />
              <Button
                label="Retake"
                variant="outline"
                onPress={() => router.push('/try-on-camera')}
                style={styles.grow}
              />
            </View>
            {/* Removing it here, rather than only in Settings, because
                this is where she is thinking about it. */}
            <Button
              label="Remove my photo"
              variant="text"
              loading={body.clearing}
              onPress={() => void body.clear()}
            />
          </Card>
        ) : (
          <Card style={styles.mine}>
            <Text variant="bodySmall" tone="secondary" uppercase={false}>
              Take one photo of yourself and see any piece on your own body. It stays private to
              you — no other student and no admin can see it, and you can delete it in one tap.
            </Text>
            <Button label="Take my photo" onPress={() => router.push('/try-on-camera')} />
          </Card>
        )}

        <Text variant="label" style={styles.section}>
          Or use a model
        </Text>
        <Text variant="bodySmall" tone="muted" uppercase={false} style={styles.hint}>
          Computer-generated. They depict no real person.
        </Text>

        <View style={styles.presets}>
          {TRYON_PRESETS.map((id) => (
            <PresetCard
              key={id}
              id={id}
              onPress={() =>
                router.replace({ pathname: '/try-on', params: { body: 'preset', preset: id } })
              }
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function PresetCard({ id, onPress }: { id: PresetId; onPress: () => void }) {
  /**
   * The files land in piece 6, once Zack and Ella have signed them off.
   * Until then the card says so rather than rendering a broken image —
   * a grey box with a label under it looks like a bug, and this does
   * not.
   */
  const source = PRESET_IMAGES[id];

  return (
    <Pressable
      onPress={source ? onPress : undefined}
      disabled={!source}
      accessibilityRole="button"
      accessibilityLabel={TRYON_PRESET_LABELS[id]}
      style={({ pressed }) => [styles.preset, pressed && styles.pressed]}
    >
      <View style={styles.presetImage}>
        {source ? (
          <Image source={source} style={styles.presetImage} resizeMode="cover" />
        ) : (
          <Text variant="caption" tone="muted" uppercase={false} style={styles.soon}>
            Coming soon
          </Text>
        )}
      </View>
      <Text variant="caption" tone="heading">
        {TRYON_PRESET_LABELS[id]}
      </Text>
    </Pressable>
  );
}

/**
 * Deliberately empty until the presets are approved. One entry per
 * preset goes in here in piece 6 and nothing else changes.
 */
const PRESET_IMAGES: Partial<Record<PresetId, number>> = {};

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  mine: { gap: spacing.md, marginTop: spacing.sm },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mineText: { flex: 1, gap: 2 },
  mineActions: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  strong: { fontWeight: '600' },
  section: { marginTop: spacing.xl },
  hint: { marginTop: spacing.xs, marginBottom: spacing.md },
  presets: { flexDirection: 'row', gap: spacing.sm },
  preset: { flex: 1, alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.6 },
  presetImage: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: radius.md,
    backgroundColor: color.surface.section,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: controls.minTapTarget,
  },
  soon: { textAlign: 'center', paddingHorizontal: spacing.xs },
});
