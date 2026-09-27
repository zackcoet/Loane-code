/**
 * Edit Listing.
 *
 * Same form component as Add to Closet, so the two cannot disagree about
 * what a listing needs.
 *
 * Removing goes through a Cloud Function and never deletes: a piece that
 * has been rented is part of someone else's history.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { color, spacing } from '@loane/shared';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { Header } from '../src/components/Header';
import { ListingForm } from '../src/components/ListingForm';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/auth/AuthProvider';
import { useListing } from '../src/hooks/useListing';
import { EMPTY_FORM, useListingForm } from '../src/hooks/useListingForm';
import { removeListing } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { logEvent } from '../src/analytics/events';

/** Cents back into the text the form edits, e.g. 2500 -> "25". */
function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

export default function EditListing() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { listing, loading, notFound } = useListing(id);

  const controller = useListingForm();
  const { hydrate } = controller;
  const [hydrated, setHydrated] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Fill the form once, when the listing arrives.
  useEffect(() => {
    if (!listing || hydrated) return;
    hydrate({
      ...EMPTY_FORM,
      name: listing.name,
      description: listing.description,
      brand: listing.brand ?? '',
      category: listing.category,
      size: listing.size,
      shoeSize: listing.shoeSize,
      condition: listing.condition,
      occasions: listing.occasions,
      intent: listing.intent,
      threeDay: centsToInput(listing.pricing.threeDayCents),
      sevenDay: centsToInput(listing.pricing.sevenDayCents),
      salePrice: centsToInput(listing.salePriceCents),
      garmentValue: centsToInput(listing.garmentValueCents),
      photos: listing.photos.map((ref) => ({ kind: 'uploaded' as const, ref })),
      availableNow: listing.status === 'active',
      blackoutDates: listing.blackoutDates ?? [],
    });
    setHydrated(true);
  }, [listing, hydrated, hydrate]);

  const onSave = async () => {
    if (!profile || !listing) return;
    const saved = await controller.save(profile, listing.id);
    if (!saved) return;
    logEvent('listing_edit', { surface: 'closet', targetType: 'listing', targetId: listing.id });
    router.back();
  };

  const onRemove = () => {
    if (!listing) return;
    Alert.alert(
      'Remove this piece?',
      'It comes out of the marketplace. If it has ever been rented we keep the record, so past rentals and reviews stay intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              const result = await removeListing({ listingId: listing.id });
              logEvent('listing_remove', {
                surface: 'closet',
                targetType: 'listing',
                targetId: listing.id,
              });
              Alert.alert(
                'Removed',
                result.data.keptForHistory
                  ? 'Taken out of the marketplace. We kept the record because it has been rented before.'
                  : 'Taken out of the marketplace.',
              );
              router.back();
            } catch (err) {
              Alert.alert('Loane', callableErrorMessage(err, 'Could not remove that. Try again.'));
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen flush>
        <Header title="Edit" onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.icon.default} />
        </View>
      </Screen>
    );
  }

  if (notFound || !listing) {
    return (
      <Screen flush>
        <Header title="Edit" onBack={() => router.back()} />
        <EmptyState title="Not found" body="That piece is no longer listed." />
      </Screen>
    );
  }

  if (listing.ownerUid !== profile?.uid) {
    return (
      <Screen flush>
        <Header title="Edit" onBack={() => router.back()} />
        <EmptyState title="Not yours" body="You can only edit pieces in your own closet." />
      </Screen>
    );
  }

  return (
    <Screen flush>
      <Header title="Edit Listing" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ListingForm controller={controller} submitLabel="Save changes" onSubmit={onSave} />
        <View style={styles.removeRow}>
          <Button
            label="Blocked dates"
            variant="outline"
            onPress={() =>
              router.push({ pathname: '/blocked-dates', params: { id: listing.id } })
            }
            style={styles.blockedButton}
          />
          <Button
            label="Remove from closet"
            variant="outline"
            loading={removing}
            onPress={onRemove}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedButton: { marginBottom: spacing.sm },
  removeRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border.default,
    paddingTop: spacing.md,
  },
});
