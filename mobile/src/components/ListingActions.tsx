/**
 * The two ways to get a piece: Loane It, or Own It.
 *
 * From Ella's mockup. The prices are ON the buttons because the
 * decision she is making is borrow-or-buy, and the two numbers are the
 * whole comparison — sending her to another screen to find them loses
 * the moment she was deciding in.
 *
 * COLOUR. Both are renter-side actions, so Ella's rule would make both
 * cherry, which gives two identical buttons and no hierarchy. Her
 * mockup draws one filled and one pale, and that is what we follow:
 * Loane It is cherry filled, Own It is cream with a merlot border.
 * Renting is the common case and the one Loane is built around; owning
 * is the quieter second option.
 *
 * SHOWN ON THE LENDER'S OWN LISTING TOO, which looks odd until you try
 * it — she needs to see exactly what a renter sees, and "what does my
 * listing look like" is the first thing anyone asks after posting one.
 * They are disabled there rather than hidden, so the page does not
 * change shape depending on who is looking.
 */

import { StyleSheet, View } from 'react-native';
import { WORDS, formatCentsShort, priceForDuration, spacing, type Listing } from '@loane/shared';
import { Button } from './Button';
import { Text } from './Text';

interface Props {
  listing: Listing;
  /** Her own listing: the buttons show, but do nothing. */
  isMine?: boolean;
  onLoaneIt: () => void;
  onOwnIt: () => void;
}

export function ListingActions({ listing, isMine = false, onLoaneIt, onOwnIt }: Props) {
  const rentable = listing.intent === 'rent' || listing.intent === 'both';
  const sellable = listing.intent === 'sell' || listing.intent === 'both';

  // The cheapest way in, which is the number worth putting on a button.
  // Falls through 1 → 3 → 7 so a listing that only prices some lengths
  // still shows a real figure rather than nothing.
  const rentCents =
    priceForDuration(listing.pricing, 1) ??
    priceForDuration(listing.pricing, 3) ??
    priceForDuration(listing.pricing, 7);
  const rentDays =
    priceForDuration(listing.pricing, 1) != null
      ? 1
      : priceForDuration(listing.pricing, 3) != null
        ? 3
        : 7;

  if (!rentable && !sellable) return null;

  return (
    <View>
      {/* Only worth saying when there is a choice to make. */}
      {rentable && sellable ? (
        <View style={styles.pitch}>
          <Text variant="h3" tone="heading">
            Love it? Make it yours.
          </Text>
          <Text variant="bodySmall" tone="secondary">
            Borrow it for the weekend or keep it forever.
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        {rentable && rentCents != null ? (
          <Button
            label={WORDS.rent}
            sublabel={`${formatCentsShort(rentCents)} / ${rentDays} ${rentDays === 1 ? 'day' : 'days'}`}
            onPress={onLoaneIt}
            disabled={isMine}
            style={styles.action}
          />
        ) : null}

        {sellable && listing.salePriceCents != null ? (
          <Button
            label={WORDS.buy}
            sublabel={`${formatCentsShort(listing.salePriceCents)} to keep`}
            variant="outline"
            onPress={onOwnIt}
            disabled={isMine}
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pitch: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  // Equal halves when there are two, full width when there is one.
  action: { flex: 1 },
});
