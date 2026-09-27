/**
 * Loane brand tokens.
 *
 * Source: "Loane Brand Strategy Visuals" deck, page 2.
 *
 * NOTE ON COLORS: the deck printed hex codes that did not match the swatches
 * shown above them for three of the five colors. Zack confirmed we use the
 * colors sampled from the actual swatch pixels. The three marked TODO-CONFIRM
 * are sampled values and should be replaced with the designer's exact hex
 * codes when we have them.
 */

export const colors = {
  /** Primary background. Warm off-white. Deck hex matched the swatch. */
  cream: '#FFFFF2',
  /** Primary brand accent. Deck hex matched the swatch. */
  maroon: '#6F0C27',
  /** TODO-CONFIRM: sampled from swatch (deck printed #b8406e, which is a pink). */
  gold: '#D6B04D',
  /** TODO-CONFIRM: sampled from swatch (deck printed #180c04, a near-black brown). */
  terracotta: '#B5784C',
  /** TODO-CONFIRM: sampled from swatch (deck printed #d57296, a pink). */
  sage: '#B8C7C2',

  // Core neutrals. The UI is mostly black on white with thin grey borders.
  black: '#000000',
  white: '#FFFFFF',
  ink: '#111111',
  textPrimary: '#111111',
  textSecondary: '#6B6B6B',
  textMuted: '#9B9B9B',
  border: '#E5E5E5',
  borderStrong: '#CFCFCF',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F7F5',
  disabled: '#EFEFEF',
  disabledText: '#B0B0B0',

  /**
   * Fallback for the campus dot next to the campus name. Real campuses
   * carry their own `brandColor` in Firestore — USC's is garnet #73000A.
   * We use the school's color, never its logo, which is trademarked.
   */
  campusDotFallback: '#111111',

  // Status colors, used sparingly (booking states, errors).
  success: '#1F7A4D',
  warning: '#B8860B',
  danger: '#B3261E',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Fonts. The real brand faces are Tenorite Bold, Telegraf and Helvetica World.
 * Tenorite is a Microsoft font that is not licensed for app embedding and
 * Telegraf is a paid license, so we ship free lookalikes until Zack supplies
 * the licensed files. Swap the `file` values only — names stay the same.
 */
export const fonts = {
  /** Headings. Placeholder for Tenorite Bold. */
  heading: 'LoaneHeading',
  /** Body and UI. Placeholder for Telegraf. */
  body: 'LoaneBody',
  /** Small uppercase letter-spaced labels. */
  label: 'LoaneBody',
} as const;

/** TODO-FONTS: replace with licensed Tenorite Bold / Telegraf files. */
export const fontPlaceholders = {
  heading: 'Archivo Bold (stand-in for Tenorite Bold)',
  body: 'Inter (stand-in for Telegraf)',
} as const;

export const typography = {
  h1: { size: 32, lineHeight: 38, weight: '700' },
  h2: { size: 26, lineHeight: 32, weight: '700' },
  h3: { size: 20, lineHeight: 26, weight: '600' },
  body: { size: 17, lineHeight: 24, weight: '400' },
  bodySmall: { size: 15, lineHeight: 21, weight: '400' },
  /** Small uppercase letter-spaced label, e.g. "SIGN IN TO YOUR CLOSET". */
  label: { size: 12, lineHeight: 16, weight: '500', letterSpacing: 1.4 },
  /** The smallest text we allow anywhere — stat captions, tab labels. */
  caption: { size: 11, lineHeight: 14, weight: '500', letterSpacing: 1 },
  button: { size: 15, lineHeight: 20, weight: '600', letterSpacing: 1.2 },
} as const;

/**
 * Icon sizes.
 *
 * The app reads as "clean and minimal", not "small". These are sized against
 * what a real social app uses — Instagram's tab icons sit around 26-28pt —
 * so nothing feels undersized on a phone.
 */
export const icons = {
  /** Inline with text, e.g. a chevron in a list row. */
  sm: 18,
  /** Top bar: hamburger, search, settings, mail. */
  md: 26,
  /** Bottom tab bar. */
  lg: 28,
} as const;

/**
 * Control sizing and tap targets.
 *
 * `minTapTarget` is Apple's recommended minimum (44x44pt). Every button and
 * icon in the app must meet it, using hit slop where the glyph itself is
 * smaller than the target.
 */
export const controls = {
  minTapTarget: 44,
  buttonHeight: 56,
  buttonHeightSmall: 44,
  inputHeight: 48,
  /** Bottom tab bar, excluding the home-indicator safe area. */
  tabBarHeight: 92,
  /** The circular + in the middle of the tab bar. */
  tabBarPlus: 46,
  /** Top bar row height. */
  headerHeight: 56,
  /** Single-line rounded chip, e.g. the occasion filters on Discover. */
  chipHeight: 34,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  screenPadding: 24,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
} as const;

export const borders = {
  hairline: 1,
} as const;

export const taglines = {
  primary: 'Style. Shared.',
  secondary: 'One app. Every occasion.',
  tertiary: 'Your closet just got a lot bigger.',
} as const;

export const brand = {
  name: 'Loane',
  website: 'https://joinloane.com',
  supportEmail: 'team@joinloane.com',
  colors,
  fonts,
  typography,
  icons,
  controls,
  spacing,
  radii,
  borders,
  taglines,
} as const;
