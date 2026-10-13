/**
 * Splash — step 1 of onboarding.
 *
 * Logo, "STYLE. SHARED.", a bold black button, and a quiet sign-in link.
 */

import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, brand, color, spacing, type, fontFamilyFor } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';

export default function Splash() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.center}>
          <Logo size={104} lockup="below" />
          <Text style={styles.tagline}>
            {brand.taglines.primary.toUpperCase().replace('.', ' .')}
          </Text>
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
