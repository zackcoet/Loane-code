/**
 * Own It — asking to buy a piece outright.
 *
 * Deliberately the same shape as Request a rental, because it is the
 * same thing happening: she asks, the owner has 24 hours to answer,
 * they meet, both confirm. The only differences are that there are no
 * dates and the piece does not come back.
 *
 * THE PRICE IS THE PRICE. No Loane line, exactly as with a rental —
 * our cut comes out of the seller's side. Showing a buyer a fee she is
 * not paying would be showing her a charge that does not exist.
 *
 * "Loane isn't taking payments yet" says the same sentence rentals
 * say. When Stripe lands it is one authorization inside
 * `requestPurchase`, and nothing on this screen changes.
 */

import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { WORDS, formatCents, spacing } from '@loane/shared';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { Input } from '../src/components/Input';
import { LoaneLoader } from '../src/components/LoaneLoader';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useListing } from '../src/hooks/useListing';
import { requestPurchase } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { logEvent } from '../src/analytics/events';

export default function OwnIt() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listing, loading } = useListing(id);

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <Screen flush>
        <Header title={WORDS.buy} onBack={() => router.back()} />
        <View style={styles.centre}>
          <LoaneLoader size={34} />
        </View>
      </Screen>
    );
  }

  if (!listing || listing.salePriceCents == null) {
    return (
      <Screen flush>
        <Header title={WORDS.buy} onBack={() => router.back()} />
        <EmptyState title="Not for sale" body="This piece is not available to buy." />
      </Screen>
    );
  }

  const cleaning = listing.cleaningFeeCents ?? 0;
  const total = listing.salePriceCents + cleaning;

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestPurchase({ listingId: listing.id, message });
      logEvent('rental_requested', {
        surface: 'listing',
        targetType: 'listing',
        targetId: listing.id,
        meta: { kind: 'purchase' },
      });
      router.replace({ pathname: '/rental/[id]', params: { id: result.data.bookingId } });
    } catch (err) {
      // "On Loane until 4 Oct" arrives here — the server knows about
      // the confirmed rental, and it is the only thing that does.
      setError(callableErrorMessage(err, 'Could not send that. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen flush>
      <Header title={WORDS.buy} onBack={() => router.back()} />

      <View style={styles.content}>
        <Card style={styles.block}>
          <Text variant="label">{listing.name}</Text>
          <View style={styles.breakdown}>
            <Line label="Price" value={formatCents(listing.salePriceCents)} />
            {cleaning > 0 ? <Line label="Cleaning" value={formatCents(cleaning)} /> : null}
            <Line label="Total" value={formatCents(total)} strong />
          </View>
          <Text variant="caption" tone="muted" uppercase={false}>
            Loane isn&apos;t taking payments yet — settle this between yourselves.
          </Text>
        </Card>

        <Input
          label="Add a message"
          value={message}
          onChangeText={setMessage}
          placeholder={`Hi! I'd love to own this.`}
          multiline
          numberOfLines={3}
          style={styles.messageInput}
          error={error}
        />

        <Text variant="caption" tone="muted" uppercase={false}>
          She has 24 hours to answer. You arrange the handoff in the app, and the piece is yours
          once you both confirm.
        </Text>

        <Button label={WORDS.buyCta} onPress={() => void onSubmit()} loading={busy} />
      </View>
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text variant="bodySmall" tone={strong ? 'primary' : 'secondary'} uppercase={false}>
        {label}
      </Text>
      <Text variant="bodySmall" tone={strong ? 'heading' : 'secondary'} uppercase={false}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  block: { gap: spacing.sm },
  breakdown: { gap: spacing.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  messageInput: { height: 80, textAlignVertical: 'top' },
});
