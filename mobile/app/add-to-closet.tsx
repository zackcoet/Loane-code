/**
 * Add to Closet — list a garment to rent, sell, or both.
 */

import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Header } from '../src/components/Header';
import { ListingForm } from '../src/components/ListingForm';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/auth/AuthProvider';
import { useListingForm } from '../src/hooks/useListingForm';
import { logEvent } from '../src/analytics/events';

export default function AddToCloset() {
  const router = useRouter();
  const { profile } = useAuth();
  const controller = useListingForm();

  const onSubmit = async () => {
    if (!profile) return;
    const listingId = await controller.save(profile);
    if (!listingId) return;

    logEvent('listing_create', {
      surface: 'closet',
      targetType: 'listing',
      targetId: listingId,
      meta: { intent: controller.form.intent ?? 'rent', photos: controller.form.photos.length },
    });

    Alert.alert('Added to your closet', 'Your piece is live on your campus.');
    router.replace({ pathname: '/listing/[id]', params: { id: listingId } });
  };

  return (
    <Screen flush>
      <Header title="Add to Closet" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ListingForm controller={controller} submitLabel="Add to closet" onSubmit={onSubmit} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
