import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { controls, color, spacing } from '@loane/shared';
import { text } from '../src/theme';

export default function NotFound() {
  return (
    <View style={styles.wrapper}>
      <Text maxFontSizeMultiplier={controls.maxFontScale} style={text.h3}>
        That page doesn&apos;t exist.
      </Text>
      <Link href="/(tabs)/feed" style={[text.link, styles.link]}>
        Back to your feed
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.page,
    padding: spacing.xl,
  },
  link: { marginTop: spacing.md },
});
