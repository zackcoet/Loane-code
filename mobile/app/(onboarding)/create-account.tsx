/**
 * Step 2 (of 3) — name, school email and password.
 *
 * The first name used to have a screen of its own. One text field does
 * not earn a screen: it is part of "make me an account", and splitting
 * it out added a tap between somebody who has already decided and the
 * thing they decided to do.
 *
 * ONE email, and it must be a school address. There is no separate personal
 * email any more: the address we check the campus against is the address
 * she signs in with.
 *
 * Nothing is created here. The screen checks her school domain against the
 * `campuses` collection so she finds out immediately if we are not at her
 * school yet, then carries her answers to the username step, where one
 * server-side call builds the login and the profile together.
 *
 * TODO-BEFORE-BETA: we still do NOT send a verification email or link, and
 * the screen no longer says so — Zack's call, because it is coming. Until
 * it exists, `verificationMethod` records `domain_claimed` so we know which
 * accounts were never actually proven. University security scanners
 * follow links in incoming mail and would burn a one-time link before she
 * ever opened it. A 6-digit code is the plan — see docs/roadmap.md.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import {
  LIMITS,
  color,
  spacing,
  type,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { checkCampusEmail } from '../../src/firebase/callables';
import { callableErrorMessage } from '../../src/firebase/errors';
import { useSignupDraft } from '../../src/auth/signupDraft';
import { text } from '../../src/theme';

export default function CreateAccount() {
  const router = useRouter();
  const { firstName, setFirstName, campusEmail, setCampusEmail, setPassword: storePassword } =
    useSignupDraft();

  const [password, setPasswordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [campusName, setCampusName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tell her which school we matched — or that we are not there yet —
  // while she types, rather than after she has filled in a password.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setCampusName(null);

    if (!validateEmail(campusEmail).ok) return;

    debounce.current = setTimeout(async () => {
      try {
        const result = await checkCampusEmail({ email: campusEmail });
        if (result.data.allowed) {
          setCampusName(result.data.campusName ?? null);
          setError(null);
        } else {
          setCampusName(null);
          setError(result.data.reason ?? "Loane isn't at your school yet.");
        }
      } catch {
        // Advisory only — createAccount checks again for real.
      }
    }, 450);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [campusEmail]);

  const onContinue = async () => {
    const nameCheck = validateDisplayName(firstName);
    if (!nameCheck.ok) {
      setError(nameCheck.error ?? 'Enter your first name.');
      return;
    }

    const emailCheck = validateEmail(campusEmail);
    if (!emailCheck.ok) return setError(emailCheck.error ?? null);

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) return setError(passwordCheck.error ?? null);

    setBusy(true);
    setError(null);
    try {
      const result = await checkCampusEmail({ email: campusEmail });
      if (!result.data.allowed) {
        setError(result.data.reason ?? "Loane isn't at your school yet.");
        return;
      }
      storePassword(password);
      router.push('/(onboarding)/username');
    } catch (err) {
      setError(callableErrorMessage(err, 'Could not check that right now. Try again.'));
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
        <View style={styles.body}>
          <Text style={text.h2}>Every great closet has{'\n'}a name behind it.</Text>
          <Text style={[text.label, styles.caption]}>Create your account</Text>
          <Text style={[text.small, styles.explainer]}>
            Use your school email — it&apos;s how we keep Loane to students on your campus.
          </Text>

          <Input
            value={firstName}
            onChangeText={(value) => {
              setFirstName(value);
              if (error) setError(null);
            }}
            placeholder="First name"
            autoCapitalize="words"
            autoComplete="given-name"
            autoFocus
            returnKeyType="next"
          />
          <Input
            value={campusEmail}
            onChangeText={(value) => {
              setCampusEmail(value);
              if (error) setError(null);
            }}
            placeholder="you@email.sc.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            hint={campusName ?? undefined}
          />
          <Input
            value={password}
            onChangeText={(value) => {
              setPasswordInput(value);
              if (error) setError(null);
            }}
            placeholder={`Password (min ${LIMITS.password.min} characters)`}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            onSubmitEditing={onContinue}
            error={error}
          />

          <Button
            label="Continue"
            onPress={onContinue}
            loading={busy}
            disabled={
              firstName.trim().length === 0 ||
              campusEmail.length === 0 ||
              password.length === 0
            }
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
  body: { flex: 1, paddingTop: spacing.lg },
  caption: { marginTop: spacing.sm, marginBottom: spacing.md },
  explainer: { marginBottom: spacing.xl },
  footer: { paddingBottom: spacing.xl },
  altRow: {
    textAlign: 'center',
    fontSize: type.bodySmall.size,
    color: color.text.secondary,
  },
});
