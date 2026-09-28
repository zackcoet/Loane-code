/**
 * Root layout.
 *
 * Its main job is routing people to the right place:
 *   - signed out                  → onboarding splash
 *   - signed in, no profile yet   → finish onboarding (verify campus)
 *   - signed in with a profile    → the app
 *
 * The "signed in but no profile" state is real: onboarding creates the
 * Firebase Auth account partway through, and the profile is only written at
 * the end by the completeSignup function. If she closes the app in between,
 * this puts her back where she was.
 */

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  color,
} from '@loane/shared';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { SignupDraftProvider } from '../src/auth/signupDraft';
import { logEvent } from '../src/analytics/events';

function RootNavigator() {
  const { loading, firebaseUser, profile, needsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const group = segments[0];
    const inTabs = group === '(tabs)';
    const inOnboarding = group === '(onboarding)';
    const inAuth = group === '(auth)';

    if (profile) {
      if (!inTabs) router.replace('/(tabs)/feed');
      return;
    }

    if (needsOnboarding) {
      // Signed in with no profile. Since Phase 1 this can no longer be
      // created — createAccount writes the login and the profile together
      // or neither — but accounts made by the old two-step flow may still
      // be stuck here, so the safety net stays.
      if (!inOnboarding) router.replace('/(onboarding)/name');
      return;
    }

    if (!firebaseUser && !inOnboarding && !inAuth) {
      router.replace('/(onboarding)');
    }
  }, [loading, firebaseUser, profile, needsOnboarding, segments, router]);

  useEffect(() => {
    if (profile) logEvent('app_open', { surface: 'other' });
  }, [profile]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.icon.default} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.surface.page } }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post-sheet" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="menu"
        options={{
          // Transparent so the panel can sit over the screen it came
          // from, with the rest of the app dimmed behind it.
          presentation: 'transparentModal',
          animation: 'none',
        }}
      />
      <Stack.Screen name="help" options={{ presentation: 'card' }} />
      <Stack.Screen name="messages" options={{ presentation: 'card' }} />
      <Stack.Screen name="my-rentals" options={{ presentation: 'card' }} />
      <Stack.Screen name="my-listings" options={{ presentation: 'card' }} />
      <Stack.Screen name="my-wishlist" options={{ presentation: 'card' }} />
      <Stack.Screen name="find-friends" options={{ presentation: 'card' }} />
      <Stack.Screen name="invite-friends" options={{ presentation: 'card' }} />
      <Stack.Screen name="payouts" options={{ presentation: 'card' }} />
      <Stack.Screen name="settings" options={{ presentation: 'card' }} />
      <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
      <Stack.Screen name="change-password" options={{ presentation: 'card' }} />
      <Stack.Screen name="notification-preferences" options={{ presentation: 'card' }} />
      <Stack.Screen name="privacy" options={{ presentation: 'card' }} />
      <Stack.Screen name="u/[username]" options={{ presentation: 'card' }} />
      <Stack.Screen name="add-to-closet" options={{ presentation: 'card' }} />
      <Stack.Screen name="post-look" options={{ presentation: 'card' }} />
      <Stack.Screen name="edit-post" options={{ presentation: 'card' }} />
      <Stack.Screen name="post/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="request-rental" options={{ presentation: 'card' }} />
      <Stack.Screen name="rental/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="blocked-dates" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="blocked-users" options={{ presentation: 'card' }} />
      <Stack.Screen name="liked" options={{ presentation: 'card' }} />
      {/* Both slide up from the bottom: they belong to the post you are
          looking at rather than being somewhere you navigated to. */}
      <Stack.Screen name="comments" options={{ presentation: 'modal' }} />
      <Stack.Screen name="send-post" options={{ presentation: 'modal' }} />
      <Stack.Screen name="recently-rented" options={{ presentation: 'card' }} />
      <Stack.Screen name="edit-listing" options={{ presentation: 'card' }} />
      <Stack.Screen name="listing/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SignupDraftProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SignupDraftProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.page,
  },
});
