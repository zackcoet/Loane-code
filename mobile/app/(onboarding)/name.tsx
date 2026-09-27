/**
 * Step 2 — first name. "Every great closet has a name behind it."
 */

import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import {
  color,
  spacing,
  type,
  validateDisplayName,
} from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { text } from '../../src/theme';
import { useSignupDraft } from '../../src/auth/signupDraft';

export default function NameStep() {
  const router = useRouter();
  const { firstName, setFirstName } = useSignupDraft();
  const [error, setError] = useState<string | null>(null);

  const onContinue = () => {
    const check = validateDisplayName(firstName);
    if (!check.ok) {
      setError(check.error ?? 'Enter your first name.');
      return;
    }
    setError(null);
    router.push('/(onboarding)/create-account');
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
          <Text style={[text.label, styles.caption]}>What&apos;s yours?</Text>

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
            onSubmitEditing={onContinue}
            error={error}
          />
        </View>

        <View style={styles.footer}>
          <Button label="Continue" onPress={onContinue} disabled={firstName.trim().length === 0} />
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
  altRow: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: type.bodySmall.size,
    color: color.text.secondary,
  },
});
