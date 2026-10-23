/**
 * Splash — step 1 of onboarding.
 *
 * Logo, "STYLE. SHARED.", a bold black button, and a quiet sign-in link.
 *
 * Under the tagline, once the campus has 50+ students: "Join 120+ girls
 * at USC". Hidden below that — see shared/src/socialProof.ts. The campus
 * document is public, so this works before she has an account.
 */

import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  fonts,
  brand,
  color,
  spacing,
  type,
  fontFamilyFor,
  LAUNCH_CAMPUS_ID,
  socialProofLine,
} from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { useCampusName } from '../../src/hooks/useCampus';

export default function Splash() {
  const router = useRouter();
  const { campus } = useCampusName(LAUNCH_CAMPUS_ID);
  const proof = campus ? socialProofLine(campus.stats?.userCount, campus.shortName) : null;

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.center}>
          <Logo size={104} lockup="below" />
          <Text style={styles.tagline}>
            {brand.taglines.primary.toUpperCase().replace('.', ' .')}
          </Text>
          {proof ? <Text style={styles.proof}>{proof}</Text> : null}
        </View>

        <View style={styles.footer}>
          <Button
            label="Find your campus closet"
            onPress={() => router.push('/(onboarding)/create-account')}
          />
          <Link href="/(auth)/sign-in" style={styles.signIn}>
            Sign in
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
    transform: [{ translateY: -spacing.xxl }],
  },
  center: { alignItems: 'center' },
  tagline: {
    fontFamily: fontFamilyFor(type.label.weight),
    marginTop: spacing.lg,
    fontSize: type.label.size,
    letterSpacing: 3,
    color: color.text.secondary,
  },
  proof: {
    fontFamily: fonts.body,
    marginTop: spacing.md,
    fontSize: type.bodySmall.size,
    color: color.text.primary,
  },
  footer: { marginTop: spacing.xxl },
  signIn: {
    fontFamily: fonts.body,
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: type.bodySmall.size,
    color: color.text.primary,
    textDecorationLine: 'underline',
  },
});
