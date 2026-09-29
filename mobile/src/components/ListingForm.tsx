/**
 * The garment form, shared by Add to Closet and Edit Listing.
 *
 * One component so the two screens can never disagree about what a listing
 * needs — the difference between them is the title and the save button.
 */

import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
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
} from '@loane/shared';
import { Button } from './Button';
import { Chip } from './Chip';
import { Input } from './Input';
import { PhotoGrid } from './PhotoGrid';
import { Text } from './Text';
import { Toggle } from './Toggle';
import { photoUri, type useListingForm } from '../hooks/useListingForm';
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

  const rentable = form.intent === 'rent' || form.intent === 'both';
  const sellable = form.intent === 'sell' || form.intent === 'both';
  const isShoes = form.category === 'shoes';
  const needsSize = form.category != null && !UNSIZED.includes(form.category);

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
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                  isShoes
                    ? set('shoeSize', value as ShoeSize)
                    : set('size', value as Size)
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
          <Text variant="label">Rental pricing</Text>
          <View style={styles.priceRow}>
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
