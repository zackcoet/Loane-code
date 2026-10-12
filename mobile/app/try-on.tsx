/**
 * The Try-On screen — a dressing room, not a generator.
 *
 * Her photo is already there. She took it once; it stays. "Change
 * photo" is a quiet option in the header, not a step she repeats.
 *
 * TAP TO PUT ON, TAP AGAIN TO TAKE OFF. A piece she is wearing carries
 * a merlot border and a check. Tapping it again takes it off and goes
 * straight back to how she looked before, from the image we already
 * have — no call, no cost, no wait. See useDressingRoom.
 *
 * ONE PIECE PER SLOT. Another top swaps the top. A dress replaces the
 * top; a top replaces the dress. She is never accidentally wearing two
 * of the same thing.
 *
 * WHILE A NEW LOOK LOADS she keeps looking at herself with the rings
 * over the top, because ten seconds of blank screen reads as a crash.
 *
 * Tops, Dresses and Bottoms are live — a top and bottoms layer, and a
 * dress replaces both. Shoes stay inert: they have never been tested.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import {
  WORDS,
  color,
  formatCentsShort,
  priceForDuration,
  radius,
  spacing,
  type Listing,
  type PresetId,
} from '@loane/shared';
import { Button } from '../src/components/Button';
import { Header } from '../src/components/Header';
import { Icon } from '../src/components/Icon';
import { LoaneLoader } from '../src/components/LoaneLoader';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthProvider';
import { useUserListings } from '../src/hooks/useProfile';
import { useUserSettings } from '../src/hooks/useUserSettings';
import {
  isTryOnEligible,
  slotFor,
  useDressingRoom,
  useFittingRoom,
  useSaveTryOn,
  useTryOnImage,
} from '../src/hooks/useTryOn';
import { logEvent } from '../src/analytics/events';

type Tab = 'tops' | 'dresses' | 'bottoms' | 'shoes';

const TABS: { id: Tab; label: string; live: boolean }[] = [
  { id: 'tops', label: 'Tops', live: true },
  { id: 'dresses', label: 'Dresses', live: true },
  { id: 'bottoms', label: 'Bottoms', live: true },
  { id: 'shoes', label: 'Shoes', live: false },
];

export default function TryOn() {
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{
    body?: string;
    preset?: string;
    source?: string;
    listing?: string;
  }>();

  const { settings } = useUserSettings();
  const bodyPhotoPath = settings?.tryOn?.bodyPhotoPath ?? null;
  const bodyUrl = useTryOnImage(bodyPhotoPath);

  /**
   * Her own photo whenever she has one. She is not asked to choose a
   * body every time she opens the screen — she already chose, by
   * taking the photo.
   */
  const bodyKind: 'own' | 'preset' = params.body === 'preset' ? 'preset' : 'own';
  const presetId = params.preset as PresetId | undefined;

  const [tab, setTab] = useState<Tab>('tops');
  const [preselected, setPreselected] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const room = useDressingRoom(bodyKind, presetId, bodyUrl);
  const { save } = useSaveTryOn();

  const fromSaved = params.source === 'saved';
  const fitting = useFittingRoom();
  const mine = useUserListings(profile?.uid);

  const available = useMemo(() => {
    const all = fromSaved ? fitting.pieces : [...fitting.pieces, ...mine.items];
    const seen = new Set<string>();
    return all.filter((l) => (seen.has(l.id) ? false : seen.add(l.id)));
  }, [fromSaved, fitting.pieces, mine.items]);

  const shown = useMemo(
    () =>
      available.filter((l) =>
        tab === 'tops'
          ? l.category === 'tops' || l.category === 'outerwear'
          : tab === 'dresses'
            ? l.category === 'dresses'
            : tab === 'bottoms'
              ? l.category === 'bottoms'
              : false,
      ),
    [available, tab],
  );

  /*
    No photo yet: the chooser, not the camera.

    She may not want to put a photograph of her own body into an app at
    all, and a model is a perfectly good answer — sending her straight
    to a viewfinder presumes she has already decided.
  */
  useEffect(() => {
    if (bodyKind !== 'own') return;
    if (settings && !bodyPhotoPath) router.replace('/try-on-body');
  }, [settings, bodyPhotoPath, bodyKind, router]);

  // Arriving from a Try on button on a card.
  useEffect(() => {
    if (preselected || !params.listing) return;
    const piece = available.find((l) => l.id === params.listing);
    if (!piece) return;
    setPreselected(true);
    if (!isTryOnEligible(piece)) return;
    const slot = slotFor(piece.category);
    setTab(slot === 'dress' ? 'dresses' : slot === 'bottom' ? 'bottoms' : 'tops');
    room.tap({
      listingId: piece.id,
      name: piece.name,
      coverUrl: piece.coverUrl,
      ownerUid: piece.ownerUid,
      category: piece.category,
    });
  }, [preselected, params.listing, available, room]);

  const onSave = async () => {
    if (!room.currentTryOnId) return;
    await save(room.currentTryOnId);
    setSavedId(room.currentTryOnId);
  };

  return (
    <Screen flush>
      <Header
        title="Try it on"
        onBack={() => router.back()}
        right={
          <Pressable
            // The chooser, not the camera: from here she can swap
            // between her own photo and a model either way round.
            onPress={() => router.push('/try-on-body')}
            accessibilityRole="button"
            accessibilityLabel="Change photo or model"
            style={styles.changePhoto}
          >
            <Text variant="caption" tone="secondary" uppercase={false} style={styles.underline}>
              Change photo
            </Text>
          </Pressable>
        }
      />

      {/* --- Her ------------------------------------------------------- */}
      <View style={styles.stage}>
        {room.shownUrl ? (
          <Image
            source={{ uri: room.shownUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.centre}>
            <Icon name="shirt-outline" size={34} tint={color.icon.muted} />
            <Text variant="bodySmall" tone="muted" uppercase={false}>
              Pick a piece to try on
            </Text>
          </View>
        )}

        {/* OVER her, not instead of her. Ten seconds of blank screen
            reads as a crash; ten seconds of herself with the rings on
            top reads as working. */}
        {room.state.busy ? (
          <View style={styles.loading} pointerEvents="none">
            <LoaneLoader size={44} />
            <Text variant="caption" tone="inverse" uppercase={false} style={styles.loadingCopy}>
              Putting it on you…
            </Text>
          </View>
        ) : null}
      </View>

      {room.outfit.length > 0 && !room.state.busy ? (
        <Text variant="caption" tone="muted" uppercase={false} style={styles.disclaimer}>
          An AI approximation — not a guide to fit, size or colour.
        </Text>
      ) : null}

      {room.state.error ? (
        <Text variant="caption" tone="error" uppercase={false} style={styles.disclaimer}>
          {room.state.error}
        </Text>
      ) : null}

      {/* --- What she is wearing --------------------------------------- */}
      {room.outfit.length > 0 ? (
        <View style={styles.actions}>
          <Button
            label="Clear"
            variant="outline"
            onPress={room.reset}
            style={styles.grow}
          />
          {room.currentTryOnId ? (
            <Button
              label={savedId === room.currentTryOnId ? 'Saved' : 'Save look'}
              onPress={() => void onSave()}
              disabled={savedId === room.currentTryOnId}
              style={styles.grow}
            />
          ) : null}
        </View>
      ) : null}

      {room.outfit.length > 0 && !room.state.busy ? (
        <View style={styles.onHer}>
          {/*
            One row per piece she is wearing, top first.

            The outfit is GENERATED bottoms-first, because whatever goes
            on second survives best — but reading down a body starts at
            the top, so the rows are reversed for display only. The
            order that matters to FASHN and the order that matters to
            her are not the same order.
          */}
          {[...room.outfit].reverse().map((piece) => (
            <PieceRow
              key={piece.listingId}
              listing={available.find((l) => l.id === piece.listingId)}
              name={piece.name}
              onOpen={() => {
                // The existing event with surface 'tryon', so try-on →
                // rental is comparable with feed → rental.
                logEvent('listing_view', {
                  surface: 'tryon',
                  targetType: 'listing',
                  targetId: piece.listingId,
                });
                router.push({ pathname: '/listing/[id]', params: { id: piece.listingId } });
              }}
            />
          ))}
        </View>
      ) : null}

      {/* --- The rail --------------------------------------------------- */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          if (!t.live) {
            return (
              <View key={t.id} style={[styles.tab, styles.tabDead]}>
                <Text variant="caption" tone="muted">
                  {t.label}
                </Text>
                <Text variant="caption" tone="muted" uppercase={false} style={styles.soonTag}>
                  soon
                </Text>
              </View>
            );
          }
          const n = available.filter((l) =>
            t.id === 'tops'
              ? l.category === 'tops' || l.category === 'outerwear'
              : t.id === 'dresses'
                ? l.category === 'dresses'
                : l.category === 'bottoms',
          ).length;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.id }}
              style={[styles.tab, tab === t.id && styles.tabOn]}
            >
              <Text variant="caption" tone={tab === t.id ? 'inverse' : 'heading'}>
                {n > 0 ? `${t.label} ${n}` : t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {shown.length === 0 ? (
        <View style={styles.soon}>
          <Text variant="bodySmall" tone="muted" uppercase={false} style={styles.soonText}>
            Nothing here yet. Save a piece with a lay-it-flat photo and it shows up.
          </Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(l) => l.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          // The row closes over what she is wearing, which the list
          // cannot see changing on its own.
          extraData={room.outfit}
          renderItem={({ item }) => {
            const canTry = isTryOnEligible(item);
            const on = room.isWearing(item.id);
            const summary = {
              listingId: item.id,
              name: item.name,
              coverUrl: item.coverUrl,
              ownerUid: item.ownerUid,
              category: item.category,
            };
            // Only where it is true: a look she has already seen comes
            // back from this session's cache and costs nothing.
            const costs = canTry && !on && room.costsAGeneration(summary);

            return (
              <Pressable
                onPress={() => room.tap(summary)}
                disabled={!canTry || room.state.busy}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={
                  !canTry
                    ? `${item.name}. No try-on photo yet.`
                    : on
                      ? `Take off ${item.name}`
                      : `Try on ${item.name}`
                }
                style={({ pressed }) => [
                  styles.piece,
                  pressed && styles.piecePressed,
                  !canTry && styles.pieceOff,
                ]}
              >
                <View style={[styles.pieceFrame, on && styles.pieceFrameOn]}>
                  <Image
                    source={{ uri: item.flatPhoto?.url ?? item.coverUrl ?? undefined }}
                    style={styles.pieceImage}
                    resizeMode="cover"
                  />
                  {on ? (
                    <View style={styles.check}>
                      <Icon name="checkmark" size={12} tint={color.text.inverse} />
                    </View>
                  ) : null}
                </View>
                <Text variant="caption" numberOfLines={1} uppercase={false}>
                  {item.name}
                </Text>
                {!canTry ? (
                  <Text variant="caption" tone="muted" numberOfLines={2} uppercase={false}>
                    No try-on photo yet.
                  </Text>
                ) : costs ? (
                  <Text variant="caption" tone="muted" numberOfLines={1} uppercase={false}>
                    Uses 1 try-on
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

/** One piece on her, with Loane It and Own It carrying the prices. */
function PieceRow({
  listing,
  name,
  onOpen,
}: {
  listing: Listing | undefined;
  name: string;
  onOpen: () => void;
}) {
  const rentCents = listing
    ? (priceForDuration(listing.pricing, 1) ??
      priceForDuration(listing.pricing, 3) ??
      priceForDuration(listing.pricing, 7))
    : null;

  return (
    <View style={styles.pieceRow}>
      <Text variant="bodySmall" numberOfLines={1} uppercase={false} style={styles.pieceRowName}>
        {name}
      </Text>
      <View style={styles.pieceRowActions}>
        {rentCents != null ? (
          <Button
            label={WORDS.rent}
            sublabel={formatCentsShort(rentCents)}
            onPress={onOpen}
            style={styles.pieceButton}
          />
        ) : null}
        {listing?.salePriceCents != null ? (
          <Button
            label={WORDS.buy}
            sublabel={formatCentsShort(listing.salePriceCents)}
            variant="outline"
            onPress={onOpen}
            style={styles.pieceButton}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  changePhoto: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  underline: { textDecorationLine: 'underline' },
  stage: { flex: 1, minHeight: 240, backgroundColor: color.surface.section, overflow: 'hidden' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: color.scrim.behindPanel,
  },
  loadingCopy: { textAlign: 'center' },
  disclaimer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  grow: { flex: 1 },
  onHer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  pieceRow: { gap: spacing.xs },
  pieceRowName: { fontWeight: '600' },
  pieceRowActions: { flexDirection: 'row', gap: spacing.sm },
  /*
    NO fixed height. These carry a label and a price, and
    buttonHeightSmall is one line tall — which is what was slicing the
    tops off the letters. The stacked style sizes itself.
  */
  pieceButton: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surface.section,
    minHeight: 32,
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: color.role.shared.background },
  tabDead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.default,
    opacity: 0.6,
  },
  soonTag: { fontStyle: 'italic' },
  soon: { padding: spacing.md, paddingBottom: spacing.xxl },
  soonText: { textAlign: 'center' },
  rail: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  piece: { width: 92, gap: spacing.xs },
  piecePressed: { opacity: 0.5 },
  pieceOff: { opacity: 0.45 },
  pieceFrame: {
    width: 92,
    height: 112,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    // Transparent rather than absent, so putting a piece on does not
    // shift the row by two pixels.
    borderColor: 'transparent',
  },
  pieceFrameOn: { borderColor: color.role.shared.background },
  pieceImage: { width: '100%', height: '100%', backgroundColor: color.surface.muted },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.role.shared.background,
  },
});
