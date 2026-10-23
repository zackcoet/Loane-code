/**
 * Get started — three short questions straight after signup.
 *
 *   1. How will you use Loane?   rent / lend / both
 *   2. What's coming up?         occasions — seeds her For You feed
 *   3. Your size (optional)      the same sizes as Edit Profile
 *
 * Every step has Skip, and skipping the lot is fine: the answers make
 * the feed better on day one, they gate nothing. Only a brand-new
 * account is sent here (src/auth/justSignedUp.ts); the walkthrough on
 * the Feed comes after.
 *
 * Saved ONCE, at the end, so an abandoned half-way state never exists:
 * her private settings get `onboarding` (intent, occasions, when), and
 * her profile gets `sizes` only if she picked one. Sizes stay hidden on
 * her profile unless she turns them on, exactly as in Edit Profile.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  COLLECTIONS,
  borderWidth,
  OCCASION_LABELS,
  OCCASIONS,
  ONBOARDING_INTENT_COPY,
  ONBOARDING_INTENTS,
  SHOE_SIZES,
  SIZES,
  cleanOccasionPicks,
  color,
  controls,
  fontFamilyFor,
  fonts,
  spacing,
  type,
  type Occasion,
  type OnboardingIntent,
  type ShoeSize,
  type Size,
  type Timestampish,
  type User,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Chip } from '../src/components/Chip';
import { Screen } from '../src/components/Screen';
import { SizePicker } from '../src/components/SizePicker';
import { useAuth } from '../src/auth/AuthProvider';
import { clearJustSignedUp } from '../src/auth/justSignedUp';
import { db } from '../src/firebase/config';
import { logEvent } from '../src/analytics/events';
import { useUserSettings } from '../src/hooks/useUserSettings';
import { text } from '../src/theme';

const STEPS = ['intent', 'occasions', 'size'] as const;
type Step = (typeof STEPS)[number];

type Sizes = User['sizes'];
const NO_SIZES: Sizes = { tops: null, bottoms: null, dresses: null, shoe: null };

export default function GetStarted() {
  const router = useRouter();
  const { profile } = useAuth();
  const settings = useUserSettings();

  const [stepIndex, setStepIndex] = useState(0);
  const [intent, setIntent] = useState<OnboardingIntent | null>(null);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [sizes, setSizes] = useState<Sizes>(profile?.sizes ?? NO_SIZES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step: Step = STEPS[stepIndex] ?? 'size';
  const isLast = stepIndex === STEPS.length - 1;

  // She is here now; a later sign-in on this phone goes to the Feed.
  useEffect(() => clearJustSignedUp(), []);

  const toggleOccasion = (o: Occasion) =>
    setOccasions((list) => (list.includes(o) ? list.filter((x) => x !== o) : [...list, o]));

  const finish = async (then: 'feed' | 'list') => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await settings.save({
        onboarding: {
          intent,
          occasions: cleanOccasionPicks(occasions),
          completedAt: serverTimestamp() as unknown as Timestampish,
        },
      });
      const pickedSize = Object.values(sizes).some((s) => s !== null);
      if (pickedSize) {
        await updateDoc(doc(db, COLLECTIONS.users, profile.uid), {
          sizes,
          updatedAt: serverTimestamp(),
        });
      }
      router.replace('/(tabs)/feed');
      // Listing her first piece sits on top of the Feed, so Back from it
      // lands somewhere real.
      if (then === 'list') router.push('/add-to-closet');
    } catch {
      setError('Could not save that. Try again, or skip for now.');
      setSaving(false);
    }
  };

  const advance = (action: 'next' | 'skip') => {
    // Answers only, never her size itself: a size is about her body and
    // has no business in analytics.
    const meta: Record<string, string | number | boolean> = { step, action };
    if (action === 'next') {
      if (step === 'intent' && intent) meta.intent = intent;
      if (step === 'occasions') meta.occasionCount = occasions.length;
      if (step === 'size') meta.gaveSize = Object.values(sizes).some((s) => s !== null);
    }
    logEvent('onboarding_step', { surface: 'onboarding', meta });

    if (action === 'skip') {
      // Skipping a step forgets what was half-picked on it.
      if (step === 'intent') setIntent(null);
      if (step === 'occasions') setOccasions([]);
      if (step === 'size') setSizes(profile?.sizes ?? NO_SIZES);
    }
    if (isLast) void finish('feed');
    else setStepIndex((i) => i + 1);
  };

  const canContinue =
    (step === 'intent' && intent !== null) ||
    (step === 'occasions' && occasions.length > 0) ||
    (step === 'size' && Object.values(sizes).some((s) => s !== null));

  const wantsToLend = intent === 'lend' || intent === 'both';

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.side}>
          {stepIndex > 0 ? (
            <Pressable
              onPress={() => setStepIndex((i) => i - 1)}
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              style={styles.topTap}
              hitSlop={spacing.sm}
            >
              <Text style={styles.topLink}>Back</Text>
            </Pressable>
          ) : null}
        </View>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}
        >
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, i <= stepIndex && styles.dotOn]} />
          ))}
        </View>
        <View style={[styles.side, styles.sideRight]}>
          <Pressable
            onPress={() => advance('skip')}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Skip this question"
            style={styles.topTap}
            hitSlop={spacing.sm}
          >
            <Text style={styles.topLink}>Skip</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
        {step === 'intent' ? (
          <>
            <Text style={text.display}>How will you use Loane?</Text>
            <Text style={[text.bodyMuted, styles.sub]}>
              Pick one. You can always do both later.
            </Text>
            {ONBOARDING_INTENTS.map((option) => {
              const selected = intent === option;
              const copy = ONBOARDING_INTENT_COPY[option];
              return (
                <Pressable
                  key={option}
                  onPress={() => setIntent(selected ? null : option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${copy.title}. ${copy.detail}`}
                  style={[styles.option, selected && styles.optionOn]}
                >
                  <Text style={styles.optionTitle}>{copy.title}</Text>
                  <Text style={text.small}>{copy.detail}</Text>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {step === 'occasions' ? (
          <>
            <Text style={text.display}>What's coming up?</Text>
            <Text style={[text.bodyMuted, styles.sub]}>
              Pick as many as you like. We'll show you looks for them first.
            </Text>
            <View style={styles.chips}>
              {OCCASIONS.map((o) => (
                <Chip
                  key={o}
                  label={OCCASION_LABELS[o]}
                  active={occasions.includes(o)}
                  onPress={() => toggleOccasion(o)}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 'size' ? (
          <>
            <Text style={text.display}>Your size</Text>
            <Text style={[text.bodyMuted, styles.sub]}>
              Optional. It helps you spot pieces that will fit. Only you can see it unless you turn
              it on in Edit profile.
            </Text>
            <SizePicker
              label="Tops"
              options={SIZES}
              value={sizes.tops}
              onChange={(v) => setSizes((s) => ({ ...s, tops: v as Size | null }))}
            />
            <SizePicker
              label="Bottoms"
              options={SIZES}
              value={sizes.bottoms}
              onChange={(v) => setSizes((s) => ({ ...s, bottoms: v as Size | null }))}
            />
            <SizePicker
              label="Dresses"
              options={SIZES}
              value={sizes.dresses}
              onChange={(v) => setSizes((s) => ({ ...s, dresses: v as Size | null }))}
            />
            <SizePicker
              label="Shoes"
              options={SHOE_SIZES}
              value={sizes.shoe}
              onChange={(v) => setSizes((s) => ({ ...s, shoe: v as ShoeSize | null }))}
            />
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={isLast ? 'Start exploring' : 'Next'}
          onPress={() => advance('next')}
          disabled={!canContinue}
          loading={saving}
        />
        {isLast && wantsToLend ? (
          <Button
            label="Put a piece on Loane"
            variant="outline"
            onPress={() => {
              logEvent('onboarding_step', {
                surface: 'onboarding',
                meta: { step, action: 'list_first' },
              });
              void finish('list');
            }}
            disabled={saving}
            style={styles.second}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: controls.minTapTarget,
  },
  side: { flex: 1, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  topTap: {
    minHeight: controls.minTapTarget,
    minWidth: controls.minTapTarget,
    justifyContent: 'center',
  },
  topLink: {
    fontFamily: fonts.body,
    fontSize: type.bodySmall.size,
    color: color.text.secondary,
  },
  dots: { flexDirection: 'row', gap: spacing.xs },
  dot: {
    width: spacing.lg,
    height: borderWidth.thick,
    backgroundColor: color.border.default,
  },
  dotOn: { backgroundColor: color.border.accent },
  body: { paddingTop: spacing.xl, paddingBottom: spacing.xl },
  sub: { marginTop: spacing.sm, marginBottom: spacing.xl },
  option: {
    borderWidth: borderWidth.hairline,
    borderColor: color.border.default,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: controls.minTapTarget,
    gap: spacing.xs,
  },
  optionOn: {
    borderColor: color.border.accent,
    backgroundColor: color.surface.section,
  },
  optionTitle: {
    fontFamily: fontFamilyFor('600'),
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
    fontWeight: '600',
    color: color.text.primary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { paddingBottom: spacing.xxl },
  second: { marginTop: spacing.sm },
  error: {
    fontFamily: fonts.body,
    color: color.status.error,
    fontSize: type.bodySmall.size,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
