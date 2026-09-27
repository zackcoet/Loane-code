/**
 * Step 3 — create the Firebase Auth account. "One tap and you're in."
 *
 * This is where the account starts existing. The Loane profile is not
 * created until the end of onboarding, so between here and the username
 * step she is signed in without a profile. The root layout knows about that
 * state and puts her back here if she leaves.
 */

import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { LIMITS, normalizeEmail, spacing, validateEmail, validatePassword } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { auth } from '../../src/firebase/config';
import { text } from '../../src/theme';

/** Firebase error codes turned into something a person can act on. */
function friendlyAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'That email already has an account. Try signing in.';
      case 'auth/invalid-email':
        return 'That email does not look right.';
      case 'auth/weak-password':
        return `Use at least ${LIMITS.password.min} characters.`;
      case 'auth/network-request-failed':
        return 'No connection. Check your internet and try again.';
      default:
        break;
    }
  }
  return 'Something went wrong. Try again.';
}

export default function CreateAccount() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return setError(emailCheck.error ?? null);

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) return setError(passwordCheck.error ?? null);

    setBusy(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
      router.push('/(onboarding)/verify-campus');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text style={text.h2}>One tap and you&apos;re in.</Text>
          <Text style={[text.label, styles.caption]}>Create your account</Text>

          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="Your personal email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            autoFocus
          />
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder={`Password (min ${LIMITS.password.min} characters)`}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            onSubmitEditing={onSubmit}
            error={error}
          />

          <Button
            label="Create account"
            onPress={onSubmit}
            loading={busy}
            disabled={email.length === 0 || password.length === 0}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.altRow}>
            Already have an account?{' '}
            <Link href="/(auth)/sign-in" style={text.link}>
              Sign in
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingTop: spacing.xl },
  caption: { marginTop: spacing.sm, marginBottom: spacing.xl },
  footer: { paddingBottom: spacing.xl },
  altRow: { textAlign: 'center', fontSize: 13, color: '#6B6B6B' },
});
