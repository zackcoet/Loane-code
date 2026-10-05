import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { color, spacing, type LegalDoc, type LegalDocKind } from '@loane/shared';
import { Header } from './Header';
import { MarkdownText } from './MarkdownText';
import { Screen } from './Screen';
import { Text } from './Text';
import { useLatestLegalDocs } from '../hooks/useLegalDocs';

interface Props {
  kind: LegalDocKind | null;
  onClose: () => void;
}

export function LegalDocumentModal({ kind, onClose }: Props) {
  const { latest, loading, error } = useLatestLegalDocs();
  const doc: LegalDoc | null = kind ? latest[kind] : null;

  return (
    <Modal visible={kind !== null} animationType="slide" onRequestClose={onClose}>
      <Screen flush>
        <Header title={doc?.title ?? 'Legal'} onBack={onClose} />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={color.icon.default} />
          </View>
        ) : error ? (
          <View style={styles.content}>
            <Text tone="error">{error}</Text>
          </View>
        ) : !doc ? (
          <View style={styles.content}>
            <Text tone="secondary">This document is not available yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="caption" tone="muted" style={styles.meta}>
              Version {doc.version} · Effective {doc.effectiveDate}
            </Text>
            <MarkdownText markdown={doc.text} />
          </ScrollView>
        )}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  meta: { marginBottom: spacing.md },
});
