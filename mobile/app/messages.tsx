/**
 * Messages inbox. Empty state only until Phase 6 builds DMs.
 */

import { useRouter } from 'expo-router';
import { EmptyState } from '../src/components/EmptyState';
import { Screen } from '../src/components/Screen';
import { ScreenHeader } from '../src/components/ScreenHeader';

export default function Messages() {
  const router = useRouter();

  return (
    <Screen flush>
      <ScreenHeader title="Messages" onBack={() => router.back()} />
      {/* TODO-PHASE6: conversation list. */}
      <EmptyState
        title="No messages yet"
        body="Conversations with lenders and renters will appear here."
      />
    </Screen>
  );
}
