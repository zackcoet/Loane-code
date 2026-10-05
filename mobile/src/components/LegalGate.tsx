import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { color, spacing, type LegalDocKind, type User } from '@loane/shared';
import { acceptLegalDocs } from '../firebase/callables';
import { callableErrorMessage } from '../firebase/errors';
import { useLatestLegalDocs } from '../hooks/useLegalDocs';
import { Button } from './Button';
import { LegalDocumentModal } from './LegalDocumentModal';
import { Screen } from './Screen';
import { Text } from './Text';

interface Props {
  profile: User;
  children: React.ReactNode;
}

export function LegalGate({ profile, children }: Props) {
  const { latest, loading, error } = useLatestLegalDocs();
  const [openDoc, setOpenDoc] = useState<LegalDocKind | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const mustAcceptTerms =
    latest.terms?.significantChange === true &&
    profile.legalAccepted?.termsVersion !== latest.terms.version;
  const mustAcceptPrivacy =
    latest.privacy?.significantChange === true &&
    profile.legalAccepted?.privacyVersion !== latest.privacy.version;
  const mustAccept = Boolean(mustAcceptTerms || mustAcceptPrivacy);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.icon.default} />
      </View>
    );
  }

  if (!mustAccept || !latest.terms || !latest.privacy) return <>{children}</>;

  const onAccept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptLegalDocs({
        termsVersion: latest.terms!.version,
        privacyVersion: latest.privacy!.version,
      });
    } catch (err) {
      setAcceptError(callableErrorMessage(err, 'Could not record your acceptance. Try again.'));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Screen flush>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="label" tone="muted">
          Loane updated its legal terms
        </Text>
        <Text variant="h2" style={styles.title}>
          Review and accept to keep using Loane.
        </Text>
        <Text tone="secondary" style={styles.body}>
          We made a significant update to our Terms & Conditions or Privacy Policy. Please review
          the latest versions before continuing.
        </Text>

        <View style={styles.actions}>
          <Button
            label="Terms & Conditions"
            variant="outline"
            onPress={() => setOpenDoc('terms')}
          />
          <Button label="Privacy Policy" variant="outline" onPress={() => setOpenDoc('privacy')} />
        </View>

        {error ? <Text tone="error">{error}</Text> : null}
        {acceptError ? <Text tone="error">{acceptError}</Text> : null}

        <Button label="Accept and continue" onPress={onAccept} loading={accepting} />
      </ScrollView>
      <LegalDocumentModal kind={openDoc} onClose={() => setOpenDoc(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.page,
  },
  content: { padding: spacing.md, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  title: { marginTop: spacing.sm },
  body: { marginTop: spacing.md },
  actions: { gap: spacing.sm, marginVertical: spacing.lg },
});
