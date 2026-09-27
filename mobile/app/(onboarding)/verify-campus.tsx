/**
 * Step 4 — campus email. "One last thing, [Name]."
 *
 * IMPORTANT, and deliberate: we do NOT send a confirmation email. Typing
 * an sc.edu address is currently all it takes to be marked verified. That
 * was Zack's call for the MVP so nothing is blocked on it.
 *
 * Sending a real confirmation link is a MUST-DO before beta launch — see
 * docs/roadmap.md. When it ships, only the Cloud Function changes; this
 * screen stays as designed.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  COLLECTIONS,
  matchesCampusDomain,
  normalizeEmail,
  spacing,
  validateEmail,
  type Campus,
} from '@loane/shared';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { db } from '../../src/firebase/config';
import { useSignupDraft } from '../../src/auth/signupDraft';
import { text } from '../../src/theme';

export default function VerifyCampus() {
  const router = useRouter();
  const { firstName, campusEmail, setCampusEmail } = useSignupDraft();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const greeting = firstName ? `One last thing, ${firstName}.` : 'One last thing.';

  const onSubmit = async () => {
    const check = validateEmail(campusEmail);
    if (!check.ok) return setError(check.error ?? null);

    setBusy(true);
    setError(null);
    try {
      // Check the domain against the approved campus list before moving on,
      // so she finds out here rather than at the end of onboarding.
      const snap = await getDocs(
        query(collection(db, COLLECTIONS.campuses), where('isLive', '==', true)),
      );
      const match = snap.docs
        .map((d) => d.data() as Campus)
        .find((c) => matchesCampusDomain(normalizeEmail(campusEmail), c.emailDomains));

      if (!match) {
        setError(
          "We don't recognize that school email yet. Loane is starting at the University of South Carolina.",
        );
        return;
      }

      router.push('/(onboarding)/username');
    } catch {
      setError('Could not check that right now. Try again.');
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
          <Text style={text.h2}>{greeting}</Text>
          <Text style={[text.label, styles.caption]}>Verify your campus</Text>
          <Text style={[text.small, styles.explainer]}>
            Enter your university email to verify your campus. We&apos;ll check it against our
            approved list — no confirmation email will be sent.
          </Text>

          <Field
            value={campusEmail}
            onChangeText={(value) => {
              setCampusEmail(value);
              if (error) setError(null);
            }}
            placeholder="your.name@university.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={onSubmit}
            error={error}
          />

          <Button
            label="Verify campus"
            onPress={onSubmit}
            loading={busy}
            disabled={campusEmail.trim().length === 0}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingTop: spacing.xl },
  caption: { marginTop: spacing.sm, marginBottom: spacing.md },
  explainer: { marginBottom: spacing.xl },
});
