/**
 * Fonts.
 *
 * Figtree for everything structural, DM Serif Display for the big
 * moments. Both are Google Fonts: free, embeddable, no licence to chase.
 * They replace Tenorite Bold and Telegraf, which were the brand's faces
 * on paper but were never licensed for an app — so until now the app
 * quietly shipped on San Francisco and looked like nothing in
 * particular.
 *
 * WHY ONE FAMILY NAME PER WEIGHT.
 *
 * With a system font, `fontWeight: '700'` makes text bold. With an
 * EMBEDDED font it does nothing on Android and only roughly approximates
 * on iOS — each weight is a separate file and has to be asked for by
 * name. So the registered names carry the weight, and `fontFamilyFor()`
 * in the tokens maps a numeric weight to the right one.
 *
 * Four weights, not fourteen: every file ships inside the binary.
 */

import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';

export const FONTS_TO_LOAD: Record<string, number> = {
  LoaneBody: Figtree_400Regular,
  LoaneBodyMedium: Figtree_500Medium,
  LoaneBodySemibold: Figtree_600SemiBold,
  LoaneHeading: Figtree_700Bold,
  /** The serif, for headlines and empty states. One weight is enough. */
  LoaneDisplay: DMSerifDisplay_400Regular,
};

export const usingPlaceholderFonts = Object.keys(FONTS_TO_LOAD).length === 0;
