/**
 * Step 4 (of 4) — "Enter your code".
 *
 * Proof that the school inbox she signed up with is actually hers.
 * Until she gets through this screen her account exists but can do
 * nothing, and the server agrees: every function that matters calls
 * requireVerifiedStudent, and the security rules check emailConfirmed
 * for themselves. This screen is the front door, not the lock.
 *
 * ONE HIDDEN INPUT BEHIND SIX BOXES, rather than six inputs.
 *
 * Six separate fields is the obvious build and it is a trap: every one
 * needs its own focus handling, backspace has to jump backwards, and
 * pasting a code either fills one box with six digits or nothing at
 * all. iOS autofill, which offers the code above the keyboard, hands
 * the whole string to ONE field — so with six it fills the first and
 * drops the rest.
 *
 * So: a single real input, invisible, holding all six digits, with six
 * drawn boxes showing what it contains. Paste works, autofill works,
 * backspace works, and there is no focus logic at all.
 *
 * NO AUTO-SUBMIT ON THE SIXTH DIGIT. It is tempting and it is wrong
 * here: a wrong code costs one of five attempts, and firing the
 * moment she types the last digit means a mistyped digit is spent
 * before she has looked at what she typed.
 */

import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { color, controls, fonts, spacing, type, validateEmail } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { Text as LoaneText } from '../../src/components/Text';
import {
  changeUnverifiedEmail,
  confirmVerificationCode,
  sendVerificationCode,
} from '../../src/firebase/callables';
import { callableErrorMessage } from '../../src/firebase/errors';
import { useAuth } from '../../src/auth/AuthProvider';
import { useUserSettings } from '../../src/hooks/useUserSettings';
import { logEvent } from '../../src/analytics/events';
import { text } from '../../src/theme';

const CODE_LENGTH = 6;

/** How long before "Resend code" works again. */
const RESEND_SECONDS = 60;

export default function VerifyEmail() {
  const router = useRouter();
  const { profile } = useAuth();
  const { settings } = useUserSettings();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  /** Set once the server has accepted the code. See the effect below. */
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  /** The "that's not my address" state. */
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const input = useRef<ComponentRef<typeof TextInput>>(null);
  /**
   * The first code is sent once per mount, not once per render.
   *
   * Without the ref, any re-render while the send is in flight fires a
   * second one — and five of those is her whole hourly allowance gone
   * before she has typed anything.
   */
  const sent = useRef(false);

  const email = settings?.campusEmail ?? '';

  const send = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await sendVerificationCode();
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(callableErrorMessage(err, 'We could not send that code. Try again in a moment.'));
    }
  }, []);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void send();
  }, [send]);

  // Leave only when the profile itself says she is confirmed.
  useEffect(() => {
    if (confirmed && profile?.emailConfirmed) router.replace('/(tabs)/feed');
  }, [confirmed, profile?.emailConfirmed, router]);

  // The countdown. One interval, cleared on unmount.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const onSubmit = async () => {
    if (code.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await confirmVerificationCode({ code });
      logEvent('email_confirmed', { surface: 'onboarding' });
      /*
        Do NOT navigate here.

        The server has just set emailConfirmed, but the profile this
        app is holding still says false — it arrives a moment later on
        the live subscription in AuthProvider. Leaving now means the
        root layout sees an unconfirmed student and sends her straight
        back, which looks exactly like the right code being rejected.

        So: mark it, and let the effect below move her once the
        profile actually agrees.
      */
      setConfirmed(true);
    } catch (err) {
      setCode('');
      setError(callableErrorMessage(err, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (secondsLeft > 0 || busy) return;
    setBusy(true);
    setCode('');
    setNotice(null);
    await send();
    setNotice('New code sent.');
    setBusy(false);
  };

  const onSaveEmail = async () => {
    const check = validateEmail(newEmail);
    if (!check.ok) return setError(check.error ?? null);

    setBusy(true);
    setError(null);
    try {
      await changeUnverifiedEmail({ email: newEmail.trim() });
      setEditingEmail(false);
      setNewEmail('');
      setCode('');
      setSecondsLeft(RESEND_SECONDS);
      setNotice('New code sent.');
    } catch (err) {
      setError(callableErrorMessage(err, 'We could not change that address.'));
    } finally {
      setBusy(false);
    }
  };

  if (editingEmail) {
    return (
      <Screen>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.body}>
            <Logo size={44} lockup="mark" />
            <Text style={[text.h2, styles.heading]}>What&apos;s your school email?</Text>
            <Text style={[text.small, styles.explainer]}>
              We&apos;ll send a new code to this address instead.
            </Text>
            <Input
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="you@email.sc.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onSubmitEditing={() => void onSaveEmail()}
              error={error}
            />
          </View>
          <View style={styles.footer}>
            <Button
              label={busy ? 'Sending…' : 'Send a new code'}
              onPress={() => void onSaveEmail()}
              disabled={busy || newEmail.trim().length === 0}
            />
            <Pressable
              onPress={() => {
                setEditingEmail(false);
                setError(null);
              }}
              hitSlop={12}
              accessibilityRole="button"
              style={styles.quietTap}
            >
              <Text style={styles.quiet}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Logo size={44} lockup="mark" />
          <Text style={[text.h2, styles.heading]}>Check your email</Text>
          <Text style={[text.small, styles.explainer]}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.email}>{email || 'your school email'}</Text>
          </Text>

          {/* The boxes are a picture of the input's value. Tapping any
              of them focuses the one real field behind them. */}
          <Pressable
            onPress={() => input.current?.focus()}
            accessibilityRole="none"
            style={styles.boxes}
          >
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.box,
                  i === code.length && styles.boxActive,
                  error ? styles.boxError : null,
                ]}
              >
                <Text style={styles.digit}>{code[i] ?? ''}</Text>
              </View>
            ))}
          </Pressable>

          <TextInput
            ref={input}
            value={code}
            onChangeText={(value) => {
              // Digits only, so a pasted "123 456" or "code: 123456"
              // still lands correctly.
              setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH));
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            // The two that make the keyboard offer the code itself.
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            accessibilityLabel="Verification code"
            style={styles.hiddenInput}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>

        <View style={styles.footer}>
          <Button
            label={confirmed ? 'Verified' : busy ? 'Checking…' : 'Verify'}
            onPress={() => void onSubmit()}
            disabled={busy || confirmed || code.length !== CODE_LENGTH}
          />

          <Pressable
            onPress={() => void onResend()}
            disabled={secondsLeft > 0 || busy}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Resend code"
            style={styles.quietTap}
          >
            <Text style={[styles.quiet, secondsLeft > 0 && styles.quietOff]}>
              {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setNewEmail(email);
              setEditingEmail(true);
              setError(null);
            }}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.quietTap}
          >
            <Text style={styles.quiet}>Wrong email?</Text>
          </Pressable>

          <LoaneText variant="caption" tone="muted" uppercase={false} style={styles.finePrint}>
            Signed up as {profile?.firstName}. The code expires in 10 minutes.
          </LoaneText>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingTop: spacing.xl, alignItems: 'center' },
  heading: { marginTop: spacing.lg, textAlign: 'center' },
  explainer: { marginTop: spacing.sm, textAlign: 'center', color: color.text.secondary },
  email: { fontFamily: fonts.body, color: color.text.primary },
  boxes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    minHeight: controls.minTapTarget,
  },
  box: {
    width: 44,
    height: 56,
    borderBottomWidth: 2,
    borderBottomColor: color.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Where the next digit will land. */
  boxActive: { borderBottomColor: color.border.focus },
  boxError: { borderBottomColor: color.status.error },
  digit: {
    fontFamily: fonts.heading,
    // eslint-disable-next-line no-restricted-syntax
    fontSize: type.h1.size,
    lineHeight: type.h1.lineHeight,
    color: color.text.primary,
  },
  /*
    Present, focusable and typeable, but not drawn. `opacity: 0` rather
    than `display: none`, which would stop it taking the keyboard at
    all, and positioned over the boxes so the autofill bar points at
    roughly the right place.
  */
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    fontFamily: fonts.body,
    marginTop: spacing.lg,
    fontSize: type.bodySmall.size,
    lineHeight: type.bodySmall.lineHeight,
    color: color.status.error,
    textAlign: 'center',
  },
  notice: {
    fontFamily: fonts.body,
    marginTop: spacing.lg,
    fontSize: type.bodySmall.size,
    lineHeight: type.bodySmall.lineHeight,
    color: color.text.secondary,
    textAlign: 'center',
  },
  footer: { paddingBottom: spacing.xl, gap: spacing.sm },
  quietTap: {
    minHeight: controls.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quiet: {
    fontFamily: fonts.body,
    fontSize: type.bodySmall.size,
    lineHeight: type.bodySmall.lineHeight,
    color: color.text.heading,
  },
  quietOff: { color: color.text.muted },
  finePrint: { textAlign: 'center', marginTop: spacing.xs },
});
