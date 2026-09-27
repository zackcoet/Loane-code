/**
 * Step 4 (last) — claim a username, and create the account.
 *
 * This is where everything actually happens. One call to `createAccount`
 * checks the school domain, creates the login, writes the profile and
 * claims the username on the server — and if any part fails, the server
 * undoes the rest. Then we sign in with the one-time token it returns.
 *
 * The availability check here is advisory: someone could take the name in
 * the moment between checking and submitting, so the real guarantee is the
 * transaction on the server.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { signInWithCustomToken } from 'firebase/auth';
import { normalizeUsername, spacing, validateUsername } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { auth } from '../../src/firebase/config';
import { checkUsername, createAccount } from '../../src/firebase/callables';
import { callableErrorMessage } from '../../src/firebase/errors';
import { useSignupDraft } from '../../src/auth/signupDraft';
import { logEvent } from '../../src/analytics/events';
import { text } from '../../src/theme';

export default function ClaimUsername() {
  const router = useRouter();
  const { firstName, campusEmail, getPassword, hasPassword, hydrated, reset } = useSignupDraft();

  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The password is held in memory only and never written to disk, so an
  // app reload loses it. Send her back one step rather than failing at the
  // end with something she cannot act on.
  useEffect(() => {
    if (hydrated && !hasPassword) {
      router.replace('/(onboarding)/create-account');
    }
  }, [hydrated, hasPassword, router]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setAvailable(null);

    const check = validateUsername(username);
    if (!check.ok) {
      setError(username.length > 0 ? (check.error ?? null) : null);
      return;
    }
    setError(null);

    debounce.current = setTimeout(async () => {
      try {
        const result = await checkUsername({ username: normalizeUsername(username) });
        setAvailable(result.data.available);
        if (!result.data.available) setError(result.data.reason ?? 'That username is taken.');
      } catch {
        // Advisory only; the server decides for real on submit.
        setAvailable(null);
      }
    }, 400);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username]);

  const onSubmit = async () => {
    const check = validateUsername(username);
    if (!check.ok) return setError(check.error ?? null);

    const password = getPassword();
    if (!password) {
      router.replace('/(onboarding)/create-account');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await createAccount({
        firstName,
        email: campusEmail,
        password,
        username: normalizeUsername(username),
      });

      // Sign in with the one-time token the server minted. The root layout
      // sees the profile appear and moves her on.
      await signInWithCustomToken(auth, result.data.token);

      logEvent('signup_completed', { surface: 'onboarding' });
      reset();
      router.replace('/(onboarding)/intro');
    } catch (err) {
      setError(callableErrorMessage(err, 'Could not finish setting up your account. Try again.'));
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
          <Logo size={44} lockup="mark" />
          <Text style={[text.h2, styles.heading]}>Hi {firstName || 'there'},</Text>
          <Text style={text.label}>Claim your username</Text>
          <Text style={[text.small, styles.explainer]}>
            This is how the campus will know you. You can always change it later.
          </Text>

          <Field
            value={username}
            onChangeText={(value) => setUsername(value.toLowerCase())}
            placeholder="@username"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={onSubmit}
            error={error}
            hint={available === true ? 'Available' : undefined}
          />
        </View>

        <View style={styles.footer}>
          <Button
            label="Create account"
            onPress={onSubmit}
            loading={busy}
            disabled={username.trim().length === 0 || available === false}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingTop: spacing.lg },
  heading: { marginTop: spacing.lg },
  explainer: { marginTop: spacing.sm, marginBottom: spacing.xl },
  footer: { paddingBottom: spacing.xl },
});
