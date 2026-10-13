/**
 * The garment form, shared by Add to Closet and Edit Listing.
 *
 * One component so the two screens can never disagree about what a listing
 * needs — the difference between them is the title and the save button.
 */

import { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  WORDS,
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITIONS,
  LIMITS,
  OCCASIONS,
  OCCASION_LABELS,
  SHOE_SIZES,
  SIZES,
  color,
  controls,
  spacing,
  type Category,
  type Condition,
  type ListingIntent,
  type ShoeSize,
  type Size,
  TRYON_CATEGORY_MAP,
  radius,
  SAME_DAY_PREMIUM_BPS,
  SAME_DAY_RESPONSE_HOURS,
} from '@loane/shared';
import { Button } from './Button';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Input } from './Input';
import { PhotoGrid } from './PhotoGrid';
import { Text } from './Text';
import { Toggle } from './Toggle';
import { photoUri, type useListingForm } from '../hooks/useListingForm';
import { useKeyboardPadding } from '../hooks/useKeyboardPadding';
import { MakeTryOnReady } from './MakeTryOnReady';
import { useTryOnEnabled } from '../hooks/useTryOn';
import { pickPhoto } from '../lib/photo';

const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags: 'New with tags',
  like_new: 'Like new',
  good: 'Good',
  well_loved: 'Well loved',
};

const INTENTS: { value: ListingIntent; label: string }[] = [
  { value: 'rent', label: 'For rent' },
  { value: 'sell', label: 'For sale' },
  { value: 'both', label: 'Both' },
];

/** Categories that are not sized XS–XL. */
const UNSIZED: Category[] = ['bags', 'accessories', 'jewelry'];

interface Props {
  controller: ReturnType<typeof useListingForm>;
  submitLabel: string;
  onSubmit: () => void;
}

export function ListingForm({ controller, submitLabel, onSubmit }: Props) {
  const { form, set, toggleOccasion, addPhoto, removePhoto, cropPhoto, makeCover, error, saving } =
    controller;
  const keyboardPadding = useKeyboardPadding();
  const [makingTryOnReady, setMakingTryOnReady] = useState(false);

  const rentable = form.intent === 'rent' || form.intent === 'both';
  const sellable = form.intent === 'sell' || form.intent === 'both';
  const isShoes = form.category === 'shoes';
  const needsSize = form.category != null && !UNSIZED.includes(form.category);
  // Try-on is off for v1: no flat-photo step, nothing to explain.
  const tryOnOn = useTryOnEnabled();
  const tryOnEligible =
    form.category != null && form.category in TRYON_CATEGORY_MAP;

  const onAddPhoto = () => {
    const run = async (source: 'camera' | 'library') => {
      const picked = await pickPhoto(source, 'free');
      if (picked) addPhoto(picked);
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

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        keyboardPadding > 0 && { paddingBottom: keyboardPadding },
      ]}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="label">This garment is…</Text>
      <View style={styles.intentRow}>
        {INTENTS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={form.intent === option.value}
            onPress={() => set('intent', option.value)}
          />
        ))}
      </View>
      <Text variant="bodySmall" tone="muted" style={styles.hint}>
        {rentable && sellable
          ? 'People can rent it for 3 or 7 days, or buy it outright.'
          : rentable
            ? 'People can request it for 3 or 7 days.'
            : sellable
              ? 'People can buy it outright.'
              : 'Others can request to rent it for 3 or 7 days.'}
      </Text>

      <Text variant="label" style={styles.section}>
        Photos
      </Text>
      <Text variant="bodySmall" tone="muted" style={styles.hint}>
        The first photo is the cover. Tap a photo to change it.
      </Text>
      <PhotoGrid
        photos={form.photos.map((p) => ({ uri: photoUri(p) }))}
        max={LIMITS.listingPhotos.max}
        onAdd={onAddPhoto}
        onRemove={removePhoto}
        onMakeCover={makeCover}
        onCrop={(index) => void cropPhoto(index)}
      />

      {/*
        Optional, and only for categories a try-on can actually do.
        Asking somebody to photograph a handbag for a feature that
        cannot put a handbag on anybody is asking for work that buys
        her nothing.
      */}
      {tryOnOn && tryOnEligible ? (
        <View style={styles.tryOnCard}>
          <View style={styles.tryOnHead}>
            <Icon name="sparkles" size={18} tint={color.role.shared.background} />
            <View style={styles.tryOnHeadText}>
              <Text variant="bodySmall" tone="heading" uppercase={false} style={styles.strong}>
                Make it try-on ready
              </Text>
              <Text variant="caption" tone="muted" uppercase={false}>
                Renters can see it on themselves.
              </Text>
            </View>
          </View>

          {form.flatPhoto ? (
            <View style={styles.tryOnDone}>
              <Image
                source={{ uri: photoUri(form.flatPhoto) }}
                style={styles.tryOnThumb}
                resizeMode="contain"
              />
              <View style={styles.tryOnDoneText}>
                <View style={styles.tryOnBadge}>
                  <Icon name="checkmark" size={12} tint={color.role.shared.label} />
                  <Text variant="caption" tone="inverse" uppercase={false}>
                    Try-on ready
                  </Text>
                </View>
                <Text variant="caption" tone="muted" uppercase={false}>
                  This is what renters will try on.
                </Text>
              </View>
              <Pressable
                onPress={() => set('flatPhoto', null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Remove the try-on photo"
              >
                <Icon name="close" size={16} tint={color.icon.muted} />
              </Pressable>
            </View>
          ) : (
            <Button
              label="Add a try-on photo"
              variant="outline"
              onPress={() => setMakingTryOnReady(true)}
            />
          )}
        </View>
      ) : null}

      {/*
        Per listing, not per account. A gown at her parents' house and
        a jacket in her wardrobe are not the same promise.
      */}
      {rentable ? (
        <View style={styles.section}>
          <Toggle
            label="Available same day"
            help={
              form.sameDay
                ? `Renters can ask for it today. You have ${SAME_DAY_RESPONSE_HOURS} hours to answer, and they pay ${SAME_DAY_PREMIUM_BPS / 100}% more.`
                : 'Turn this on if you can hand a piece over the same day it is asked for.'
            }
            value={form.sameDay}
            onValueChange={(v) => set('sameDay', v)}
          />
        </View>
      ) : null}

      <MakeTryOnReady
        visible={makingTryOnReady}
        onClose={() => setMakingTryOnReady(false)}
        onReady={(picked) => set('flatPhoto', { kind: 'local', picked })}
      />

      <View style={styles.section}>
        <Input
          label="Item name"
          value={form.name}
          onChangeText={(v) => set('name', v)}
          placeholder="e.g. Vintage Silk Slip Dress"
          maxLength={LIMITS.listingName.max}
        />
        <Input
          label="Description"
          value={form.description}
          onChangeText={(v) => set('description', v)}
          placeholder="Describe the fit, fabric, and condition."
          multiline
          numberOfLines={3}
          maxLength={LIMITS.listingDescription.max}
          style={styles.multiline}
        />
        <Input
          label="Brand"
          value={form.brand}
          onChangeText={(v) => set('brand', v)}
          placeholder="e.g. Reformation (optional)"
          maxLength={LIMITS.brand.max}
        />
      </View>

      <Text variant="label">Category</Text>
      <View style={styles.wrapRow}>
        {CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={CATEGORY_LABELS[value]}
            active={form.category === value}
            onPress={() => set('category', value)}
          />
        ))}
      </View>

      {needsSize ? (
        <>
          <Text variant="label" style={styles.section}>
            Size
          </Text>
          <View style={styles.wrapRow}>
            {(isShoes ? SHOE_SIZES : SIZES).map((value) => (
              <Chip
                key={value}
                label={value}
                active={isShoes ? form.shoeSize === value : form.size === value}
                onPress={() =>
                  isShoes ? set('shoeSize', value as ShoeSize) : set('size', value as Size)
                }
              />
            ))}
          </View>
        </>
      ) : null}

      <Text variant="label" style={styles.section}>
        Condition
      </Text>
      <View style={styles.wrapRow}>
        {CONDITIONS.map((value) => (
          <Chip
            key={value}
            label={CONDITION_LABELS[value]}
            active={form.condition === value}
            onPress={() => set('condition', value)}
          />
        ))}
      </View>

      <Text variant="label" style={styles.section}>
        Occasions
      </Text>
      <Text variant="bodySmall" tone="muted" style={styles.hint}>
        This is how people find it. Pick every one that fits.
      </Text>
      <View style={styles.wrapRow}>
        {OCCASIONS.map((value) => (
          <Chip
            key={value}
            label={OCCASION_LABELS[value]}
            active={form.occasions.includes(value)}
            onPress={() => toggleOccasion(value)}
          />
        ))}
      </View>

      {rentable ? (
        <View style={styles.section}>
          <Text variant="label">{WORDS.rent} pricing</Text>
          <View style={styles.priceRow}>
            <Input
              label="1 day"
              value={form.oneDay}
              onChangeText={(v) => set('oneDay', v)}
              placeholder="$0"
              keyboardType="decimal-pad"
              style={styles.priceInput}
            />
            <Input
              label="3 days"
              value={form.threeDay}
              onChangeText={(v) => set('threeDay', v)}
              placeholder="$0"
              keyboardType="decimal-pad"
              style={styles.priceInput}
            />
            <Input
              label="7 days"
              value={form.sevenDay}
              onChangeText={(v) => set('sevenDay', v)}
              placeholder="$0"
              keyboardType="decimal-pad"
              style={styles.priceInput}
            />
          </View>

          <Input
            label="Cleaning fee (optional)"
            value={form.cleaningFee}
            onChangeText={(v) => set('cleaningFee', v)}
            placeholder="$0"
            keyboardType="decimal-pad"
            hint="Charged on top of the rental. You keep all of it — Loane takes no cut of cleaning."
          />
        </View>
      ) : null}

      {sellable ? (
        <Input
          label="Sale price"
          value={form.salePrice}
          onChangeText={(v) => set('salePrice', v)}
          placeholder="$0"
          keyboardType="decimal-pad"
        />
      ) : null}

      {rentable ? (
        <Input
          label="What it's worth"
          value={form.garmentValue}
          onChangeText={(v) => set('garmentValue', v)}
          placeholder="$0"
          keyboardType="decimal-pad"
          hint="Used to protect you if a piece comes back damaged. Not shown to renters."
        />
      ) : null}

      <Text variant="label" style={styles.section}>
        Availability
      </Text>
      <Toggle
        label="Available now"
        help={
          form.availableNow
            ? 'People can find and request this piece.'
            : 'Hidden from the marketplace until you switch this on.'
        }
        value={form.availableNow}
        onValueChange={(v) => set('availableNow', v)}
      />
      {/* TODO-PHASE4: blocking out specific dates needs the booking
          calendar, so the picker lands with it. The field already exists. */}

      {error ? (
        <Text variant="bodySmall" tone="error" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Button label={submitLabel} onPress={onSubmit} loading={saving} style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  section: { marginTop: spacing.lg },
  tryOnCard: {
    marginTop: spacing.xl,
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border.default,
    backgroundColor: color.surface.section,
  },
  tryOnHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tryOnHeadText: { flex: 1, gap: 2 },
  tryOnDone: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tryOnThumb: {
    width: 56,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: color.surface.raised,
  },
  tryOnDoneText: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  tryOnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: color.role.shared.background,
  },
  strong: { fontWeight: '600' },
  hint: { marginTop: spacing.xs, marginBottom: spacing.sm },
  intentRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  multiline: { height: 88, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  priceInput: { minWidth: 0 },
  error: {
    marginTop: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: color.border.error,
    paddingLeft: spacing.sm,
  },
  submit: { marginTop: spacing.lg, height: controls.buttonHeight },
});
