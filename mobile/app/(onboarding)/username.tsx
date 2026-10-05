/**
 * Step 3 (last) — claim a username, and create the account.
 *
 * Straight into the feed from here. There used to be three intro
 * slides between this and the app: a carousel explaining a feed, shown
 * to somebody who had just finished signing up to see the feed. The
 * feed explains itself faster.
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { signInWithCustomToken } from 'firebase/auth';
import {
  color,
  normalizeUsername,
  spacing,
  suggestUsernames,
  type as typography,
  type LegalDocKind,
  validateUsername,
} from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { LegalDocumentModal } from '../../src/components/LegalDocumentModal';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
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
  const [legalOpen, setLegalOpen] = useState<LegalDocKind | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Prefill from what she already told us.
   *
   * She typed a school email one screen ago, so `ellapetrick@email.sc.edu`
   * fills this in as `ellapetrick` before she sees the field. A blank box
   * asking a stranger to invent a name is the slowest step in signup, and
   * the one most likely to lose her.
   *
   * `touched` is the whole contract: the moment she edits the field we
   * never write to it again. A suggestion that keeps reappearing over
   * what somebody is typing is far worse than no suggestion.
   */
  const [touched, setTouched] = useState(false);
  const candidates = useMemo(
    () => suggestUsernames({ firstName, campusEmail }),
    [firstName, campusEmail],
  );
  // Which suggestion we are currently offering. Only moves while she has
  // not touched the field, and only because the one before it was taken.
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const suggested = !touched ? (candidates[suggestionIndex] ?? '') : '';

  useEffect(() => {
    // Waits for the draft to hydrate from disk, which is when firstName
    // and campusEmail actually arrive.
    if (!hydrated || touched || !suggested) return;
    setUsername(suggested);
  }, [hydrated, touched, suggested]);

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
        if (result.data.available) return;

        // Our suggestion was taken. Quietly move to the next one rather
        // than telling her a name she never chose is unavailable — that
        // reads as her mistake, and it is not.
        if (!touched && suggestionIndex < candidates.length - 1) {
          setSuggestionIndex((i) => i + 1);
          return;
        }
        setError(result.data.reason ?? 'That username is taken.');
      } catch {
        // Advisory only; the server decides for real on submit.
        setAvailable(null);
      }
    }, 400);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username, touched, suggestionIndex, candidates.length]);

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
      router.replace('/(tabs)/feed');
    } catch (err) {
      setError(callableErrorMessage(err, 'Could not finish setting up your account. Try again.'));
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
          <Logo size={44} lockup="mark" />
          <Text style={[text.h2, styles.heading]}>Hi {firstName || 'there'},</Text>
          <Text style={text.label}>Claim your username</Text>
          <Text style={[text.small, styles.explainer]}>
            This is how the campus will know you. You can always change it later.
          </Text>

          <Input
            value={username}
            onChangeText={(value) => {
              // From here on the field is hers. Nothing writes to it again.
              setTouched(true);
              setUsername(value.toLowerCase());
            }}
            placeholder="@username"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={onSubmit}
            error={error}
            hint={
              available === true
                ? touched
                  ? 'Available'
                  : 'Available — tap to change it'
                : undefined
            }
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.finePrint}>
            By tapping Create account, you agree to our{' '}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => setLegalOpen('terms')}
            >
              Terms & Conditions
            </Text>{' '}
            and{' '}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => setLegalOpen('privacy')}
            >
              Privacy Policy
            </Text>
            .
          </Text>
          <Button
            label="Create account"
            onPress={onSubmit}
            loading={busy}
            disabled={username.trim().length === 0 || available === false}
          />
        </View>
      </KeyboardAvoidingView>
      <LegalDocumentModal kind={legalOpen} onClose={() => setLegalOpen(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingTop: spacing.lg },
  heading: { marginTop: spacing.lg },
  explainer: { marginTop: spacing.sm, marginBottom: spacing.xl },
  footer: { paddingBottom: spacing.xxxl },
  finePrint: {
    marginBottom: spacing.md,
    color: color.text.secondary,
    textAlign: 'center',
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
  },
  link: {
    color: color.text.primary,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    textDecorationLine: 'underline',
  },
});
