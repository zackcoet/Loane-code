/**
 * The Try-On screen.
 *
 * Body on top, pieces underneath. Tap a piece and it goes on her.
 *
 * TABS ARE TOPS AND DRESSES, with Bottoms and Shoes present but inert.
 * "Coming soon" rather than hidden, so she can see where this is going
 * — and because Phase 0 showed bottoms desaturate and bleed colour at
 * the hem, which is a quality problem we have not solved rather than a
 * feature we have not written.
 *
 * OUTERWEAR APPEARS UNDER TOPS, because that is what it maps to at
 * FASHN and because four live tabs for three categories is more
 * navigation than the content deserves.
 *
 * The pieces come from her Saved items and her own closet, and only
 * ones with a lay-it-flat photo appear at all. A piece she cannot try
 * on is not shown greyed out — it is simply not here.
 *
 * The wait is about 8 seconds, which is long enough that a bare spinner
 * reads as a hang. LoaneLoader plus a line of copy.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import {
  WORDS,
  color,
  controls,
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
import {
  isTryOnEligible,
  useFittingRoom,
  useSaveTryOn,
  useTryOnImage,
  useTryOnStack,
} from '../src/hooks/useTryOn';
import { logEvent } from '../src/analytics/events';

type Tab = 'tops' | 'dresses' | 'bottoms' | 'shoes';

const TABS: { id: Tab; label: string; live: boolean }[] = [
  { id: 'tops', label: 'Tops', live: true },
  { id: 'dresses', label: 'Dresses', live: true },
  { id: 'bottoms', label: 'Bottoms', live: false },
  { id: 'shoes', label: 'Shoes', live: false },
];

export default function TryOn() {
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{
    body?: string;
    preset?: string;
    /** 'saved' opens as a fitting room: only what she has saved. */
    source?: string;
    /** A piece to put on immediately, from a Try on button on a card. */
    listing?: string;
  }>();

  const bodyKind = params.body === 'own' ? 'own' : 'preset';
  const presetId = (params.preset as PresetId | undefined) ?? 'medium';

  const [tab, setTab] = useState<Tab>('tops');
  /** Guards the preselect so it fires once, not on every render. */
  const [preselected, setPreselected] = useState(false);
  const { stack, state, add, undo, reset } = useTryOnStack(bodyKind, presetId);
  const { save } = useSaveTryOn();
  const [saved, setSaved] = useState(false);

  const resultUrl = useTryOnImage(state.result?.imagePath ?? null);

  // --- What she can try on ----------------------------------------------
  /**
   * The fitting room, or everything.
   *
   * From Saved she sees only what she has saved — that is the whole
   * point of the entry point, and a row that quietly added her own
   * closet would not be the thing the button promised.
   */
  const fromSaved = params.source === 'saved';
  const fitting = useFittingRoom();
  const mine = useUserListings(profile?.uid);

  const available = useMemo(() => {
    const all = fromSaved ? fitting.pieces : [...fitting.pieces, ...mine.items];
    const seen = new Set<string>();
    return all.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [fromSaved, fitting.pieces, mine.items]);

  /**
   * Ineligible pieces are SHOWN, greyed, saying why — not hidden. In a
   * browse they would be absent, but these are her own saved things
   * and a row that drops half of them reads as broken. See
   * useFittingRoom.
   */
  const shown = useMemo(
    () =>
      available.filter((l) => {
        // Outerwear rides with Tops: it maps to FASHN's 'tops', and a
        // fourth tab for one category is not worth the navigation.
        if (tab === 'tops') return l.category === 'tops' || l.category === 'outerwear';
        if (tab === 'dresses') return l.category === 'dresses';
        return false;
      }),
    [available, tab],
  );

  const eligible = available;


  /**
   * Arriving from a "Try on" button on a card: put that piece on
   * straight away, and switch to the tab it lives under so the row
   * underneath makes sense rather than showing an unrelated category.
   */
  useEffect(() => {
    if (preselected || !params.listing) return;
    const piece = available.find((l) => l.id === params.listing);
    if (!piece) return;
    setPreselected(true);
    if (!isTryOnEligible(piece)) return;
    setTab(piece.category === 'dresses' ? 'dresses' : 'tops');
    add({
      listingId: piece.id,
      name: piece.name,
      coverUrl: piece.coverUrl,
      ownerUid: piece.ownerUid,
      category: piece.category,
    });
  }, [preselected, params.listing, available, add]);

  const onSave = async () => {
    if (!state.result) return;
    await save(state.result.tryOnId);
    setSaved(true);
  };

  return (
    <Screen flush>
      <Header title="Try it on" onBack={() => router.back()} />

      {/* --- The body ------------------------------------------------- */}
      <View style={styles.stage}>
        {state.busy ? (
          <View style={styles.centre}>
            <LoaneLoader size={44} />
            <Text variant="bodySmall" tone="secondary" uppercase={false} style={styles.waitCopy}>
              Putting it on you…
            </Text>
            <Text variant="caption" tone="muted" uppercase={false}>
              About 8 seconds
            </Text>
          </View>
        ) : resultUrl ? (
          <Image source={{ uri: resultUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <View style={styles.centre}>
            <Icon name="shirt-outline" size={34} tint={color.icon.muted} />
            <Text variant="bodySmall" tone="muted" uppercase={false} style={styles.waitCopy}>
              {bodyKind === 'own' ? 'Pick a piece to see it on you' : 'Pick a piece to try on'}
            </Text>
            <Button
              label="Change body"
              variant="text"
              onPress={() => router.replace('/try-on-body')}
            />
          </View>
        )}
      </View>

      {/* An AI approximation, said once, where it cannot be missed and
          cannot be mistaken for a measurement. */}
      {state.result ? (
        <Text variant="caption" tone="muted" uppercase={false} style={styles.disclaimer}>
          An AI approximation — not a guide to fit, size or colour.
        </Text>
      ) : null}

      {state.error ? (
        <Text variant="caption" tone="error" uppercase={false} style={styles.disclaimer}>
          {state.error}
        </Text>
      ) : null}

      {/* --- What is on her, and what to do about it ------------------- */}
      {stack.length > 0 ? (
        <View style={styles.actions}>
          <Button label="Undo" variant="outline" onPress={undo} style={styles.grow} />
          <Button
            label="Reset"
            variant="text"
            onPress={() => {
              reset();
              setSaved(false);
            }}
            style={styles.grow}
          />
          {state.result ? (
            <Button
              label={saved ? 'Saved' : 'Save look'}
              onPress={() => void onSave()}
              disabled={saved}
              style={styles.grow}
            />
          ) : null}
        </View>
      ) : null}

      {/* Each piece on her, with the same two buttons as the listing
          screen. This is the whole point of the feature: a try-on that
          cannot be acted on is a toy. */}
      {state.result && stack.length > 0 ? (
        <View style={styles.onHer}>
          {stack.map((piece) => (
            <PieceRow
              key={piece.listingId}
              listing={eligible.find((l) => l.id === piece.listingId)}
              name={piece.name}
              onOpen={() => {
                // The existing event, with surface 'tryon' — so try-on →
                // rental is comparable with feed → rental. NOT a bespoke
                // event, which would sit outside every funnel we have.
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

      {/* --- The pieces ------------------------------------------------ */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          /*
            Bottoms and Shoes are visibly inert, not tappable tabs that
            then explain themselves. Phase 0 found bottoms desaturate
            and bleed colour at the hem; that is a quality problem we
            have not solved, so the tab says so and does nothing.
          */
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
          // The count, so an empty tab is obviously empty rather than
          // looking like something failed to load.
          const n = available.filter((l) =>
            t.id === 'tops'
              ? l.category === 'tops' || l.category === 'outerwear'
              : l.category === 'dresses',
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
          renderItem={({ item }) => {
            const on = stack.some((p) => p.listingId === item.id);
            const canTry = isTryOnEligible(item);
            return (
              <Pressable
                onPress={() =>
                  add({
                    listingId: item.id,
                    name: item.name,
                    coverUrl: item.coverUrl,
                    ownerUid: item.ownerUid,
                    category: item.category,
                  })
                }
                disabled={!canTry || state.busy || on}
                accessibilityRole="button"
                accessibilityLabel={
                  canTry
                    ? `Try on ${item.name}`
                    : `${item.name}. No try-on photo yet.`
                }
                style={({ pressed }) => [
                  styles.piece,
                  (pressed || on) && styles.piecePressed,
                  !canTry && styles.pieceOff,
                ]}
              >
                <Image
                  source={{ uri: item.flatPhoto?.url ?? item.coverUrl ?? undefined }}
                  style={styles.pieceImage}
                  resizeMode="cover"
                />
                <Text variant="caption" numberOfLines={1} uppercase={false}>
                  {item.name}
                </Text>
                {/* Why it cannot be tapped, rather than silently
                    dropping it from a row of her own saved pieces. */}
                {canTry ? null : (
                  <Text variant="caption" tone="muted" numberOfLines={2} uppercase={false}>
                    No try-on photo yet.
                  </Text>
                )}
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
  stage: {
    flex: 1,
    minHeight: 260,
    backgroundColor: color.surface.section,
    overflow: 'hidden',
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  waitCopy: { textAlign: 'center' },
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
  pieceButton: { flex: 1, height: controls.buttonHeightSmall },
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
  // Visibly out of action, still legible. Not hidden — see the row.
  pieceOff: { opacity: 0.45 },
  pieceImage: {
    width: 92,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: color.surface.muted,
  },
});
