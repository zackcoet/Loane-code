/**
 * Post a Look.
 *
 * Photos, a caption, occasion tags, and Instagram-style tagging: tap the
 * spot on the photo where the piece is, pick it from your closet, and a
 * dot appears there. Several tags per photo, several photos per post.
 *
 * Tag positions are fractions of the photo, not pixels — see
 * docs/post-tagging.md.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  LIMITS,
  OCCASIONS,
  OCCASION_LABELS,
  color,
  controls,
  spacing,
  type Listing,
  type Occasion,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Chip } from '../src/components/Chip';
import { ClosetPicker } from '../src/components/ClosetPicker';
import { Header } from '../src/components/Header';
import { Input } from '../src/components/Input';
import { Screen } from '../src/components/Screen';
import { TaggablePhoto, type PlacedTag } from '../src/components/TaggablePhoto';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useUserListings } from '../src/hooks/useProfile';
import { createPost } from '../src/firebase/callables';
import { callableErrorMessage } from '../src/firebase/errors';
import { pickPhoto, uploadPostPhoto, type PickedPhoto } from '../src/lib/photo';
import { logEvent } from '../src/analytics/events';

interface DraftPhoto {
  picked: PickedPhoto;
  tags: PlacedTag[];
}

export default function PostLook() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items: myListings } = useUserListings(profile?.uid);

  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [caption, setCaption] = useState('');
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Which photo we are placing a tag on, and where.
  const [pending, setPending] = useState<{ index: number; x: number; y: number } | null>(null);

  const active = useMemo(() => myListings.filter((l) => l.status === 'active'), [myListings]);
  const tagCount = photos.reduce((total, photo) => total + photo.tags.length, 0);

  const addPhoto = () => {
    const run = async (source: 'camera' | 'library') => {
      const picked = await pickPhoto(source, 'free');
      if (picked) setPhotos((current) => [...current, { picked, tags: [] }]);
      setError(null);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take a photo', 'Choose from library'], cancelButtonIndex: 0 },
        (index) => {
          if (index === 1) void run('camera');
          if (index === 2) void run('library');
        },
      );
    } else {
      Alert.alert('Add a photo', undefined, [
        { text: 'Take a photo', onPress: () => void run('camera') },
        { text: 'Choose from library', onPress: () => void run('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const placeTag = (listing: Listing) => {
    if (!pending) return;
    setPhotos((current) =>
      current.map((photo, index) =>
        index === pending.index
          ? {
              ...photo,
              tags: [
                ...photo.tags,
                {
                  listingId: listing.id,
                  x: pending.x,
                  y: pending.y,
                  name: listing.name,
                  priceCents3Day: listing.pricing.threeDayCents,
                  salePriceCents: listing.salePriceCents,
                },
              ],
            }
          : photo,
      ),
    );
    setPending(null);
  };

  const onPublish = async () => {
    if (!profile) return;
    if (photos.length === 0) return setError('Add at least one photo.');

    setPosting(true);
    setError(null);
    try {
      // A throwaway id just to group this post's photos in storage. The
      // real post id comes back from the server.
      const draftId = `draft-${Date.now()}`;

      const uploaded = [];
      for (const [index, photo] of photos.entries()) {
        const ref = await uploadPostPhoto(profile.uid, draftId, photo.picked, index);
        uploaded.push({
          ...ref,
          tags: photo.tags.map((tag) => ({ listingId: tag.listingId, x: tag.x, y: tag.y })),
        });
      }

      const result = await createPost({ photos: uploaded, caption, occasions });

      logEvent('post_create', {
        surface: 'feed',
        targetType: 'post',
        targetId: result.data.postId,
        meta: { photos: photos.length, tags: tagCount },
      });

      router.back();
    } catch (err) {
      setError(callableErrorMessage(err, 'Could not publish that. Try again.'));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Screen flush>
      <Header title="Post a Look" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {photos.length === 0 ? (
            <Pressable
              onPress={addPhoto}
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
              style={styles.empty}
            >
              <Text variant="h2" tone="muted">
                +
              </Text>
              <Text variant="label" tone="muted">
                Add photo
              </Text>
            </Pressable>
          ) : (
            photos.map((photo, index) => (
              <View key={`${photo.picked.uri}-${index}`} style={styles.photoBlock}>
                <TaggablePhoto
                  uri={photo.picked.uri}
                  tags={photo.tags}
                  mode="compose"
                  onPlaceTag={(x, y) => {
                    if (active.length === 0) {
                      setError('Add a piece to your closet first, then you can tag it.');
                      return;
                    }
                    setPending({ index, x, y });
                  }}
                  onRemoveTag={(listingId) =>
                    setPhotos((current) =>
                      current.map((p, i) =>
                        i === index
                          ? { ...p, tags: p.tags.filter((t) => t.listingId !== listingId) }
                          : p,
                      ),
                    )
                  }
                />
                <View style={styles.photoActions}>
                  <Text variant="caption" tone="muted">
                    {photo.tags.length === 0
                      ? 'Tap the photo where a piece is to tag it'
                      : `${photo.tags.length} tagged · tap a dot to remove`}
                  </Text>
                  <Text
                    variant="caption"
                    tone="error"
                    accessibilityRole="button"
                    onPress={() => setPhotos((c) => c.filter((_, i) => i !== index))}
                  >
                    Remove photo
                  </Text>
                </View>
              </View>
            ))
          )}

          {photos.length > 0 && photos.length < LIMITS.postPhotos.max ? (
            <Button
              label="Add another photo"
              variant="outline"
              onPress={addPhoto}
              style={styles.addMore}
            />
          ) : null}

          <Input
            label="Caption"
            value={caption}
            onChangeText={setCaption}
            placeholder="Tell the story of this look…"
            multiline
            numberOfLines={3}
            maxLength={LIMITS.postCaption.max}
            style={styles.multiline}
          />

          <Text variant="label">Event / occasion (optional)</Text>
          <View style={styles.chipRow}>
            {OCCASIONS.map((value) => (
              <Chip
                key={value}
                label={OCCASION_LABELS[value]}
                active={occasions.includes(value)}
                onPress={() =>
                  setOccasions((current) =>
                    current.includes(value)
                      ? current.filter((o) => o !== value)
                      : [...current, value],
                  )
                }
              />
            ))}
          </View>

          {error ? (
            <Text variant="bodySmall" tone="error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            label="Publish look"
            onPress={onPublish}
            loading={posting}
            disabled={photos.length === 0}
            style={styles.publish}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ClosetPicker
        visible={pending !== null}
        listings={active}
        takenIds={pending ? photos[pending.index]?.tags.map((t) => t.listingId) ?? [] : []}
        onPick={placeTag}
        onClose={() => setPending(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  empty: {
    aspectRatio: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border.default,
    backgroundColor: color.surface.muted,
  },
  photoBlock: { marginBottom: spacing.md },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  addMore: { height: controls.buttonHeightSmall, marginBottom: spacing.lg },
  multiline: { height: 88, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  error: { marginTop: spacing.md },
  publish: { marginTop: spacing.lg },
});
