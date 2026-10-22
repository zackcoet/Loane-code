/**
 * What she sees if a screen crashes, instead of a white screen.
 *
 * Expo Router shows this for any route whose render throws (it is the
 * root layout's `ErrorBoundary`). "Try again" re-renders the screen that
 * broke; "Back to the feed" is the way out if it keeps breaking. The
 * crash goes to the crash reporter, which is switched off for now.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { color, spacing } from '@loane/shared';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { captureError } from '../monitoring/crashReporter';

interface Props {
  error: Error;
  retry: () => Promise<void>;
}

export function CrashScreen({ error, retry }: Props) {
  const router = useRouter();

  useEffect(() => {
    captureError(error, { where: 'screen-crash' });
  }, [error]);

  return (
    <View style={styles.page}>
      <EmptyState
        title="Something went wrong"
        body="That screen hit a snag. Try again, or head back to the feed."
        actionLabel="Try again"
        onAction={() => void retry()}
      />
      <View style={styles.secondary}>
        <Button
          label="Back to the feed"
          variant="text"
          onPress={() => {
            // Move off the broken screen first, then clear the crash so
            // the app re-renders on the feed rather than on the same bug.
            router.replace('/(tabs)/feed');
            void retry();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.surface.page, justifyContent: 'center' },
  secondary: { alignItems: 'center', paddingBottom: spacing.xxl },
});
