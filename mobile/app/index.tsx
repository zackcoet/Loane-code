/**
 * `/` — the front door.
 *
 * Every other screen in the app lives inside a group: `(tabs)`,
 * `(auth)`, `(onboarding)`. Nothing lived at the root itself, which
 * was fine right up until somebody actually arrived there — and
 * scanning the Expo QR code opens `exp://…/--/`, which is exactly
 * that. The result was expo-router's "Unmatched Route" screen with no
 * way out.
 *
 * The root layout's redirect did not catch it. That guard asks which
 * GROUP she is in, and at `/` the answer is none: not onboarding, not
 * auth, so a signed-in student fell straight through it and landed
 * nowhere. It only bit people who were already signed in, which is
 * why it looked intermittent rather than broken.
 *
 * A redirect in the layout effect would have fixed the symptom. A real
 * route fixes the cause: `/` now resolves to something, the way every
 * other path does, and it cannot depend on an effect winning a race
 * against the renderer.
 */

import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { color } from '@loane/shared';
import { LoaneLoader } from '../src/components/LoaneLoader';
import { useAuth } from '../src/auth/AuthProvider';

export default function Index() {
  const { loading, profile, needsOnboarding } = useAuth();

  // The root layout shows its own loader while auth settles, so this
  // is belt and braces — but rendering a Redirect off an unresolved
  // session would send her to the splash and straight back out again.
  if (loading) {
    return (
      <View style={styles.loading}>
        <LoaneLoader size={44} />
      </View>
    );
  }

  if (profile) return <Redirect href="/(tabs)/feed" />;

  // Signed in with no profile: an account from the old two-step signup
  // that never finished. See the root layout for why that state exists.
  if (needsOnboarding) return <Redirect href="/(onboarding)/create-account" />;

  return <Redirect href="/(onboarding)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.page,
  },
});
