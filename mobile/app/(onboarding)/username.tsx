/**
 * Step 5 — claim a username. "Hi [Name], claim your username"
 *
 * Submitting calls `completeSignup`, which claims the username and creates
 * her profile in one transaction. Once the profile exists, the root layout
 * sees it and moves her on to the intro slides.
 *
 * The availability check here is only advisory — someone could take the
 * name between the check and the submit, so the real uniqueness guarantee
 * is the transaction on the server.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { normalizeUsername, spacing, validateDisplayName, validateUsername } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { checkUsername, completeSignup } from '../../src/firebase/callables';
import { useSignupDraft } from '../../src/auth/signupDraft';
import { logEvent } from '../../src/analytics/events';
import { callableErrorMessage } from '../../src/firebase/errors';
import { text } from '../../src/theme';

export default function ClaimUsername() {
  const router = useRouter();
  const { firstName, campusEmail, setFirstName, reset } = useSignupDraft();

  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check availability as she types, but not on every keystroke.
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
        // Availability is advisory; the server decides for real on submit.
        setAvailable(null);
      }
    }, 400);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username]);

  const onSubmit = async () => {
    // Safety net: if the draft was lost (a reinstall, cleared storage), ask
    // for the name here rather than submitting an empty one and dead-ending
    // on a server error she cannot act on.
    const nameCheck = validateDisplayName(firstName);
    if (!nameCheck.ok) return setError('We lost your first name — add it above and try again.');

    const check = validateUsername(username);
    if (!check.ok) return setError(check.error ?? null);

    setBusy(true);
    setError(null);
    try {
      await completeSignup({
        firstName,
        campusEmail,
        username: normalizeUsername(username),
      });
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

          {validateDisplayName(firstName).ok ? null : (
            <Field
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              autoCapitalize="words"
              label="First name"
            />
          )}

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
            label="Continue"
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
  body: { flex: 1, paddingTop: spacing.xl },
  heading: { marginTop: spacing.lg },
  explainer: { marginTop: spacing.sm, marginBottom: spacing.xl },
  footer: { paddingBottom: spacing.xl },
});
