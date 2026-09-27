/**
 * Splash — step 1 of onboarding.
 *
 * Logo, "STYLE. SHARED.", a bold black button, and a quiet sign-in link.
 */

import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { brand, colors, spacing, typography } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';

export default function Splash() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.center}>
        <Logo size={104} lockup="across" />
        <Text style={styles.tagline}>{brand.taglines.primary.toUpperCase().replace('.', ' .')}</Text>
      </View>

      <View style={styles.footer}>
        <Button label="Find your campus closet" onPress={() => router.push('/(onboarding)/name')} />
        <Link href="/(auth)/sign-in" style={styles.signIn}>
          Sign in
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tagline: {
    marginTop: spacing.lg,
    fontSize: typography.label.size,
    letterSpacing: 3,
    color: colors.textSecondary,
  },
  footer: { paddingBottom: spacing.xxl },
  signIn: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: typography.bodySmall.size,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
});
