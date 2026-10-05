/**
 * "Add a new piece", reached from tagging a photo.
 *
 * Without this, tagging is useless to a student on her first day: she
 * cannot tag anything until her closet is already full, which is exactly
 * backwards — the outfit she is posting IS the piece she wants to list.
 *
 * It is the REAL add-to-closet form, not a shortened copy.
 *
 * A shorter form was the obvious idea and the wrong one. Every field the
 * validator insists on — category, size, an occasion, rent or sell, the
 * prices — is required to make a piece actually rentable. A quick form
 * that skipped them would create listings nobody can rent, and a second
 * form would drift from the first the moment either changed.
 *
 * What makes it quick instead is that we already know things: the
 * occasions she picked for the look, and that she is almost certainly
 * renting rather than selling.
 */

import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Header } from '../../src/components/Header';
import { ListingForm } from '../../src/components/ListingForm';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';
import { useListingForm } from '../../src/hooks/useListingForm';
import { usePostDraft } from '../../src/post/postDraft';
import { logEvent } from '../../src/analytics/events';

export default function QuickAddPiece() {
  const router = useRouter();
  const { profile } = useAuth();
  const draft = usePostDraft();
  const { photoId } = useLocalSearchParams<{ photoId?: string }>();
  const controller = useListingForm();

  // Carry over what she has already told us about the look. Occasions are
  // the slowest part of this form and she has just answered it.
  useEffect(() => {
    if (draft.occasions.length > 0) controller.set('occasions', draft.occasions);
    controller.set('intent', 'rent');
    // Empty deps on purpose: this seeds the form once, when the screen
    // opens. Re-running it would stamp over her own edits.
  }, []);

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

    if (!photoId) {
      // Reached somehow without knowing which photo to tag. The piece is
      // still saved, which is the part that would have hurt to lose.
      Alert.alert('Added to your closet', 'Your piece is live on your campus.');
      router.back();
      return;
    }

    // Hand the new listing back to the tagging screen, which places it
    // exactly where she tapped.
    //
    // navigate, not back-then-setParams: back() does not carry params,
    // and setParams after it would land on whichever screen happened to
    // be on top by then. navigate pops to the tag screen already in the
    // stack and hands it the new values.
    router.navigate({
      pathname: '/new-post/tag',
      params: { taggedListingId: listingId, photoId },
    });
  };

  return (
    <Screen flush>
      <Header title="Add a piece" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ListingForm controller={controller} submitLabel="Add and tag" onSubmit={onSubmit} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
