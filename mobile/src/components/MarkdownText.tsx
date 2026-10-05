import { StyleSheet, View } from 'react-native';
import { color, spacing } from '@loane/shared';
import { Text } from './Text';

interface Props {
  markdown: string;
}

export function MarkdownText({ markdown }: Props) {
  const lines = markdown.split('\n');
  return (
    <View style={styles.wrap}>
      {lines.map((raw, index) => {
        const line = raw.trimEnd();
        const key = `${index}-${line.slice(0, 12)}`;
        if (!line.trim()) return <View key={key} style={styles.blank} />;

        if (line.startsWith('# ')) {
          return (
            <Text key={key} variant="h2" style={styles.h1}>
              {line.replace(/^#\s+/, '')}
            </Text>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={key} variant="h3" style={styles.h2}>
              {line.replace(/^##\s+/, '')}
            </Text>
          );
        }
        if (line.startsWith('|')) {
          return (
            <Text key={key} variant="caption" uppercase={false} style={styles.table}>
              {line}
            </Text>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <Text key={key} style={styles.body}>
              {'\u2022 '}
              {cleanInline(line.slice(2))}
            </Text>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <Text key={key} style={styles.body}>
              {cleanInline(line)}
            </Text>
          );
        }
        return (
          <Text key={key} style={styles.body}>
            {cleanInline(line)}
          </Text>
        );
      })}
    </View>
  );
}

function cleanInline(value: string) {
  return value.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  blank: { height: spacing.sm },
  h1: { marginTop: spacing.sm },
  h2: { marginTop: spacing.md },
  body: { color: color.text.primary },
  table: {
    color: color.text.secondary,
    fontFamily: 'Courier',
  },
});
