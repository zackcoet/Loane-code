/**
 * Delete my account. Settings → Delete my account.
 *
 * Apple requires an in-app way to delete an account (guideline
 * 5.1.1(v)), and it must actually delete — not just deactivate or say
 * "email us".
 *
 * Two deliberate steps, no more: she types her password (so an unlocked
 * phone on a desk is not enough), then confirms in a final alert that
 * says plainly what goes and what stays. The server re-checks both the
 * fresh sign-in and her open rentals — the screen is for her, the
 * function is the rule. See backend/functions/src/auth/deleteAccount.ts.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { color, spacing } from '@loane/shared';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { Screen } from '../src/components/Screen';
import { Header } from '../src/components/Header';
import { auth } from '../src/firebase/config';
import { deleteMyAccount } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { text } from '../src/theme';

const GOES = [
  'Your profile, photo, bio and sizes',
  'Your looks, your closet, and your comments',
  'Your likes, saves, followers and following',
  'Your phone number and school email',
  'Your login — you will be signed out',
];

const STAYS = [
  'Past rentals, as a record for the other student',
  'Reviews you wrote, shown as "Deleted account"',
  'Chats, which the other person keeps, under "Deleted account"',
];

function passwordError(error: unknown): string | null {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'That password is not right.';
      case 'auth/too-many-requests':
        return 'Too many tries. Wait a minute and try again.';
      case 'auth/network-request-failed':
        return 'No connection. Check your internet and try again.';
      default:
        break;
    }
  }
  return null;
}

export default function DeleteAccount() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      setError('Sign in again and retry.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Fresh sign-in first. The server refuses anything older than a
      // few minutes, so this is what lets the next call through.
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      // A brand-new token carries the new sign-in time to the server.
      await user.getIdToken(true);
      await deleteMyAccount();
    } catch (err) {
      setError(
        passwordError(err) ??
          callableErrorMessage(err, 'Could not delete your account. Try again.'),
      );
      setBusy(false);
      return;
    }

    // Her login no longer exists. Signing out clears the phone's copy
    // and the root layout takes her back to the welcome screen.
    if (router.canDismiss()) router.dismissAll();
    await signOut(auth).catch(() => undefined);
    Alert.alert('Account deleted', 'Your Loane account has been deleted. Thanks for being here.');
  };

  const onDelete = () => {
    Alert.alert(
      'Delete your account?',
      'Everything listed here goes for good. This cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void run() },
      ],
    );
  };

  return (
    <Screen flush>
      <Header title="Delete Account" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[text.h3, styles.title]}>Deleting your account is permanent.</Text>

          <View style={styles.band}>
            <Text style={[text.label, styles.groupLabel]}>What gets deleted</Text>
            {GOES.map((line) => (
              <Text key={line} style={[text.body, styles.line]}>
                {`•  ${line}`}
              </Text>
            ))}
          </View>

          <Text style={[text.label, styles.groupLabel]}>What stays, without your name</Text>
          {STAYS.map((line) => (
            <Text key={line} style={[text.bodyMuted, styles.line]}>
              {`•  ${line}`}
            </Text>
          ))}

          <Text style={[text.small, styles.note]}>
            If you have a rental still going, finish or cancel it in My Rentals first.
          </Text>

          <Input
            label="Your password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            error={error}
          />

          <Button
            label="Delete my account"
            onPress={onDelete}
            loading={busy}
            disabled={!password || busy}
          />
          <Button label="Keep my account" variant="text" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  title: { marginBottom: spacing.sm },
  // A band, not the canvas — the page stays white.
  band: {
    backgroundColor: color.surface.section,
    padding: spacing.md,
    marginHorizontal: -spacing.md,
    marginBottom: spacing.sm,
  },
  groupLabel: { marginBottom: spacing.xs },
  line: { marginBottom: spacing.xs },
  note: { marginVertical: spacing.md },
});
