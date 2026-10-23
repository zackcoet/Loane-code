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
 * server so she finds out immediately if the address is not a .edu, then
 * carries her answers to the username step, where one
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
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  controls,
  emailDomain,
  fonts,
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
import { useKeyboardPadding } from '../../src/hooks/useKeyboardPadding';
import { text } from '../../src/theme';

export default function CreateAccount() {
  const router = useRouter();
  const {
    firstName,
    setFirstName,
    campusEmail,
    setCampusEmail,
    setPassword: storePassword,
  } = useSignupDraft();

  const [password, setPasswordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [campusName, setCampusName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyboardInset = useKeyboardPadding(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailCheck = validateEmail(campusEmail);
  const emailIsEdu = emailDomain(campusEmail)?.endsWith('.edu') ?? false;
  const canContinue =
    firstName.trim().length > 0 && emailCheck.ok && emailIsEdu && password.length > 0;

  // Tell her which school/domain we matched while she types, rather than
  // after she has filled in a password.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setCampusName(null);

    if (!emailCheck.ok) return;
    if (!emailIsEdu) {
      setError('Use your .edu school email.');
      return;
    }

    debounce.current = setTimeout(async () => {
      try {
        const result = await checkCampusEmail({ email: campusEmail });
        if (result.data.allowed) {
          setCampusName(result.data.campusName ?? null);
          setError(null);
        } else {
          setCampusName(null);
          setError(result.data.reason ?? 'Use your .edu school email.');
        }
      } catch {
        // Advisory only — createAccount checks again for real.
      }
    }, 450);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [campusEmail, emailCheck.ok, emailIsEdu]);

  const onContinue = async () => {
    const nameCheck = validateDisplayName(firstName);
    if (!nameCheck.ok) {
      setError(nameCheck.error ?? 'Enter your first name.');
      return;
    }

    const emailCheck = validateEmail(campusEmail);
    if (!emailCheck.ok) return setError(emailCheck.error ?? null);
    if (!emailIsEdu) return setError('Use your .edu school email.');

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) return setError(passwordCheck.error ?? null);

    setBusy(true);
    setError(null);
    try {
      const result = await checkCampusEmail({ email: campusEmail });
      if (!result.data.allowed) {
        setError(result.data.reason ?? 'Use your .edu school email.');
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
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.body,
            keyboardInset > 0 && { paddingBottom: keyboardInset + controls.buttonHeight },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Text maxFontSizeMultiplier={controls.maxFontScale} style={text.h2}>
            Every great closet has{'\n'}a name behind it.
          </Text>
          <Text maxFontSizeMultiplier={controls.maxFontScale} style={[text.label, styles.caption]}>
            Create your account
          </Text>
          <Text
            maxFontSizeMultiplier={controls.maxFontScale}
            style={[text.small, styles.explainer]}
          >
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

          <View style={styles.footer}>
            <Text maxFontSizeMultiplier={controls.maxFontScale} style={styles.altRow}>
              Already have an account?{' '}
              <Link href="/(auth)/sign-in" style={text.link}>
                Sign in
              </Link>
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.buttonBar, keyboardInset > 0 && { bottom: keyboardInset }]}>
          <Button label="Continue" onPress={onContinue} loading={busy} disabled={!canContinue} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // flexGrow, not flex: flex:1 on a scroll container clamps it to
  // the viewport height, which is the thing we are trying to escape.
  // space-between keeps the sign-in line at the bottom when there is
  // room and lets it scroll away when the keyboard takes the room.
  body: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: controls.buttonHeight + spacing.xxl,
  },
  caption: { marginTop: spacing.sm, marginBottom: spacing.md },
  explainer: { marginBottom: spacing.xl },
  footer: { paddingTop: spacing.xl },
  buttonBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: color.surface.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
  },
  altRow: {
    fontFamily: fonts.body,
    textAlign: 'center',
    fontSize: type.bodySmall.size,
    color: color.text.secondary,
  },
});
