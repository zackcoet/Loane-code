/**
 * "Welcome back." — sign in to an existing account.
 */

import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import {
  color,
  normalizeEmail,
  spacing,
  type,
  validateEmail,
} from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { auth } from '../../src/firebase/config';
import { text } from '../../src/theme';

function friendlyAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'That email and password do not match.';
      case 'auth/too-many-requests':
        return 'Too many tries. Wait a minute and try again.';
      case 'auth/network-request-failed':
        return 'No connection. Check your internet and try again.';
      default:
        break;
    }
  }
  return 'Something went wrong. Try again.';
}

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    const check = validateEmail(email);
    if (!check.ok) return setError(check.error ?? null);

    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
      // The root layout takes it from here: straight to the app if she has
      // a profile, back into onboarding if she never finished.
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Scrollable for the same reason as signup: a fixed body
            inside a keyboard-avoiding view has nowhere to put the
            button once the keyboard takes half the screen. */}
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Text style={text.h2}>Welcome back.</Text>
          <Text style={[text.label, styles.caption]}>Sign in to your closet</Text>

          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            autoFocus
          />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            onSubmitEditing={onSubmit}
            error={error}
          />

          <Button
            label="Sign in"
            onPress={onSubmit}
            loading={busy}
            disabled={email.length === 0 || password.length === 0}
          />

          <View style={styles.footer}>
            <Text style={styles.altRow}>
              Don&apos;t have an account?{' '}
              <Link href="/(onboarding)/create-account" style={text.link}>
                Create one
              </Link>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'space-between', paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  caption: { marginTop: spacing.sm, marginBottom: spacing.xl },
  footer: { paddingTop: spacing.xl },
  altRow: {
    textAlign: 'center',
    fontSize: type.bodySmall.size,
    color: color.text.secondary,
  },
});
