/**
 * Fonts.
 *
 * The brand faces are Tenorite Bold (headings) and Telegraf (body). Tenorite
 * is a Microsoft font that is not licensed for app embedding and Telegraf is
 * a paid license, so neither is in the repo yet.
 *
 * TODO-FONTS: when Zack supplies the licensed files, drop them into
 * `assets/fonts/` and register them here. Nothing else changes — every
 * screen refers to the token names, not the font names.
 *
 * Until then we fall back to the platform's own clean sans-serif, which is
 * San Francisco on iOS and Roboto on Android. Both are close enough in feel
 * that the layouts will not shift when we swap.
 */

export const FONTS_TO_LOAD: Record<string, number> = {
  // LoaneHeading: require('../../assets/fonts/Tenorite-Bold.ttf'),
  // LoaneBody: require('../../assets/fonts/Telegraf-Regular.otf'),
};

export const usingPlaceholderFonts = Object.keys(FONTS_TO_LOAD).length === 0;
