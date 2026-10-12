/**
 * Add to Closet — list a garment to rent, sell, or both.
 */

import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Header } from '../src/components/Header';
import { ListingForm } from '../src/components/ListingForm';
import { ProfileGateSheet } from '../src/components/ProfileGateSheet';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/auth/AuthProvider';
import { useListingForm } from '../src/hooks/useListingForm';
import { useProfileGate } from '../src/hooks/useProfileGate';
import { logEvent } from '../src/analytics/events';

export default function AddToCloset() {
  const router = useRouter();
  const { profile } = useAuth();
  const controller = useListingForm();
  /**
   * Gated at SUBMIT rather than on the way in.
   *
   * She has just filled out a whole form. Stopping her at the door
   * would have been cheaper for us and worse for her; stopping her
   * here costs one sheet and loses nothing she typed.
   */
  const gate = useProfileGate();

  const doSubmit = async () => {
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
        <ListingForm
          controller={controller}
          submitLabel="Add to closet"
          onSubmit={() => gate.run('listPiece', () => void doSubmit())}
        />
      </KeyboardAvoidingView>

      <ProfileGateSheet gate={gate} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
