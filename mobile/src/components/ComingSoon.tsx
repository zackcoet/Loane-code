/**
 * A placeholder screen for a menu destination whose real version is a later
 * phase. Better than a row that does nothing: she gets a title, a back
 * button, and an honest note about when it arrives.
 */

import { useRouter } from 'expo-router';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';

interface Props {
  title: string;
  body: string;
}

export function ComingSoon({ title, body }: Props) {
  const router = useRouter();

  return (
    <Screen flush>
      <ScreenHeader title={title} onBack={() => router.back()} />
      <EmptyState title="Coming soon" body={body} />
    </Screen>
  );
}
