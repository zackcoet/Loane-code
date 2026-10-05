/**
 * Step 4 — pin pieces to the photos.
 *
 * Full-bleed photo, swipe between them, tap where a garment is. The hint
 * sits OVER the top of the picture and fades once she has tagged
 * something; it used to be a line of grey text underneath the photo,
 * which looked like an error message and never went away.
 *
 * Tagging is optional. A look with no tags is a perfectly good post, and
 * the Done button never waits for one.
 *
 * Tapping an empty spot offers her closet AND a quick way to add a piece
 * she has not listed yet — without that, a new student cannot tag
 * anything at all, which is the friction that made this screen useless
 * on day one.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LIMITS, color, controls, radius, spacing, type Listing } from '@loane/shared';
import { Button } from '../../src/components/Button';
import { ClosetPicker } from '../../src/components/ClosetPicker';
import { Header } from '../../src/components/Header';
import { Screen } from '../../src/components/Screen';
import { TaggablePhoto, type PlacedTag } from '../../src/components/TaggablePhoto';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthProvider';
import { useUserListings } from '../../src/hooks/useProfile';
import { usePostDraft, type DraftPhoto } from '../../src/post/postDraft';

export default function TagPieces() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { items: myListings } = useUserListings(profile?.uid);
  const draft = usePostDraft();

  /**
   * Set by the quick-add screen when it comes back with a new listing.
   *
   * Route params rather than draft state because this is a one-shot
   * handoff, and a listing id sitting in the draft would get re-applied
   * every time she returned to this screen.
   */
  const params = useLocalSearchParams<{ taggedListingId?: string; photoId?: string }>();

  const [index, setIndex] = useState(0);
  const [picking, setPicking] = useState<{ photoId: string; x: number; y: number } | null>(null);
  /** When set, the next tap MOVES this tag instead of adding one. */
  const [moving, setMoving] = useState<{ photoId: string; index: number } | null>(null);

  const photos = draft.photos;
  const current = photos[Math.min(index, photos.length - 1)];

  // The quick-add screen just created a piece for us. Place it where she
  // tapped, then clear the params so a re-render cannot place it twice.
  //
  // In an effect, not in render: adding a tag and rewriting the route are
  // both side effects, and React may call a render more than once.
  useEffect(() => {
    const listingId = params.taggedListingId;
    const photoId = params.photoId;
    if (!listingId || !photoId) return;

    if (picking && picking.photoId === photoId) {
      draft.addTag(photoId, { listingId, x: picking.x, y: picking.y });
      setPicking(null);
    }
    router.setParams({ taggedListingId: undefined, photoId: undefined });
    // Deps are the params only, on purpose. `picking` is read but not
    // depended on: it is already set before we navigate away, and adding
    // it would re-run this handoff every time the spot changed.
  }, [params.taggedListingId, params.photoId]);

  if (!current) {
    return (
      <Screen>
        <Header title="Tag pieces" onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text variant="bodySmall" tone="secondary">
            This draft is gone. Start again from the + button.
          </Text>
        </View>
      </Screen>
    );
  }

  /** The draft's bare tags, dressed with names and prices for display. */
  const placed = (photo: DraftPhoto): PlacedTag[] =>
    photo.tags.map((tag) => {
      const listing = myListings.find((l) => l.id === tag.listingId);
      return {
        listingId: tag.listingId,
        x: tag.x,
        y: tag.y,
        name: listing?.name ?? 'Your piece',
        priceCents3Day: listing?.pricing?.threeDayCents ?? null,
        salePriceCents: listing?.salePriceCents ?? null,
      };
    });

  const onPlace = (photoId: string, x: number, y: number) => {
    if (moving && moving.photoId === photoId) {
      draft.moveTag(photoId, moving.index, x, y);
      setMoving(null);
      return;
    }

    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    if (draft.tagCount >= LIMITS.taggedListings.max) {
      Alert.alert('That is the limit', `A look can tag up to ${LIMITS.taggedListings.max} pieces.`);
      return;
    }

    const spot = { photoId, x, y };
    setPicking(spot);

    // Setting `picking` is what opens ClosetPicker, so the non-iOS path
    // needs nothing further.
    if (Platform.OS !== 'ios') return;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Select from my closet', 'Add a new piece'],
        cancelButtonIndex: 0,
        title: 'Tag a piece here',
      },
      (choice) => {
        if (choice === 0) setPicking(null);
        if (choice === 2) {
          router.push({ pathname: '/new-post/quick-add', params: { photoId } });
        }
      },
    );
  };

  const onTapTag = (photoId: string, listingId: string) => {
    const at = photos
      .find((p) => p.id === photoId)
      ?.tags.findIndex((t) => t.listingId === listingId);
    if (at == null || at < 0) return;

    const remove = () => draft.removeTag(photoId, at);

    if (Platform.OS !== 'ios') {
      remove();
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Move', 'Remove'],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 2,
      },
      (choice) => {
        if (choice === 1) setMoving({ photoId, index: at });
        if (choice === 2) remove();
      },
    );
  };

  const hint = moving
    ? 'Tap where it should go'
    : draft.tagCount === 0
      ? 'Tap a piece to tag it'
      : null;

  return (
    <Screen flush>
      <Header title="Tag pieces" onBack={() => router.back()} />

      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <TaggablePhoto
              uri={item.picked.uri}
              tags={placed(item)}
              mode="compose"
              aspectRatio={item.picked.width / item.picked.height}
              onPlaceTag={(x, y) => onPlace(item.id, x, y)}
              onRemoveTag={(listingId) => onTapTag(item.id, listingId)}
            />
          </View>
        )}
      />

      {/* Over the photo, and gone as soon as it has done its job. */}
      {hint ? (
        <View style={styles.hint} pointerEvents="none">
          <Text variant="caption" style={styles.hintText} uppercase={false}>
            {hint}
          </Text>
        </View>
      ) : null}

      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button label="Done" onPress={() => router.back()} />
      </View>

      <ClosetPicker
        visible={picking !== null && moving === null}
        listings={myListings}
        takenIds={photos.find((p) => p.id === picking?.photoId)?.tags.map((t) => t.listingId) ?? []}
        onPick={(listing: Listing) => {
          if (!picking) return;
          draft.addTag(picking.photoId, { listingId: listing.id, x: picking.x, y: picking.y });
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  hint: {
    position: 'absolute',
    top: controls.headerHeight + spacing.md,
    alignSelf: 'center',
    backgroundColor: color.accent.background,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  hintText: { color: color.accent.label, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.border.strong },
  dotActive: { backgroundColor: color.accent.background },
  footer: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
