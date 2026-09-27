/**
 * Step 6 — the three intro slides, then into the app.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing, typography } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { text } from '../../src/theme';

const SLIDES = [
  {
    kicker: 'Browse & borrow',
    title: 'Good news, your closet just\ngot a lot bigger.',
    body: 'Browse real closets from girls at your school. Find the perfect piece for any occasion — formal, gameday, date night, all of it.',
  },
  {
    kicker: 'List & earn',
    title: 'Your wardrobe\nworks for you now.',
    body: 'List a piece in under two minutes. Set your price, pick your dates, and earn money on clothes you already own. We handle everything else.',
  },
  {
    kicker: 'Your circle',
    title: 'Follow closets. Build your feed.',
    body: 'Follow closets whose style you love and browse only their pieces — or explore every closet on campus.',
  },
];

const { width } = Dimensions.get('window');

export default function Intro() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const finish = () => router.replace('/(tabs)/feed');

  const onNext = () => {
    if (index >= SLIDES.length - 1) return finish();
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  return (
    <Screen flush>
      <View style={styles.skipRow}>
        <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.flex}
      >
        {SLIDES.map((slide) => (
          <View key={slide.kicker} style={[styles.slide, { width }]}>
            <View style={styles.artPlaceholder} />
            <Text style={styles.kicker}>{slide.kicker}</Text>
            <Text style={[text.h3, styles.title]}>{slide.title}</Text>
            <Text style={[text.small, styles.body]}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.kicker} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button label={index === SLIDES.length - 1 ? "Let's go" : 'Next'} onPress={onNext} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  skip: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  slide: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  // TODO-PHASE1: replace with the real screenshots from the mockups.
  artPlaceholder: {
    width: '70%',
    aspectRatio: 0.62,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  kicker: {
    fontSize: typography.label.size,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginTop: spacing.md, maxWidth: 300 },
  footer: { paddingHorizontal: spacing.screenPadding, paddingBottom: spacing.xxl },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.black },
});
