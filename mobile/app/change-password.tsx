/**
 * Change Password.
 *
 * Firebase requires a recent sign-in before it will change a password, so
 * we ask for the current one and re-authenticate with it first. That is
 * also the right behaviour on its own: someone who picks up an unlocked
 * phone should not be able to take over the account.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import {
  LIMITS,
  spacing,
  validatePassword,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { Screen } from '../src/components/Screen';
import { Header } from '../src/components/Header';
import { auth } from '../src/firebase/config';
import { text } from '../src/theme';

function friendlyError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'That current password is not right.';
      case 'auth/weak-password':
        return `Use at least ${LIMITS.password.min} characters.`;
      case 'auth/too-many-requests':
        return 'Too many tries. Wait a minute and try again.';
      default:
        break;
    }
  }
  return 'Could not change your password. Try again.';
}

export default function ChangePassword() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      setError('Sign in again and retry.');
      return;
    }

    const check = validatePassword(next);
    if (!check.ok) return setError(check.error ?? null);
    if (next !== confirm) return setError('Those two passwords do not match.');
    if (next === current) return setError('That is already your password.');

    setBusy(true);
    setError(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      Alert.alert('Loane', 'Your password has been changed.');
      router.back();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen flush>
      <Header title="Change Password" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <Text style={[text.small, styles.explainer]}>
            For your security, confirm your current password first.
          </Text>

          <Input
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <Input
            label="New password"
            value={next}
            onChangeText={setNext}
            placeholder={`At least ${LIMITS.password.min} characters`}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            error={error}
          />

          <Button
            label="Change password"
            onPress={onSave}
            loading={busy}
            disabled={!current || !next || !confirm}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, padding: spacing.md },
  explainer: { marginBottom: spacing.lg },
});
