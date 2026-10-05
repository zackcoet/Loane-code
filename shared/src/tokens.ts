/**
 * Loane design tokens — the ONLY file allowed to contain a raw colour or a
 * raw font size. A lint rule enforces that; see docs/design-system.md.
 *
 * TWO LAYERS, on purpose.
 *
 *   palette   what a colour IS.      palette.ink900 = '#111111'
 *   color     what a colour is FOR.  color.text.primary = palette.ink900
 *
 * Screens only ever touch the second layer. That way "make the borders a
 * little softer" is one edit here instead of forty edits across the app,
 * and a rebrand changes `palette` alone.
 *
 * If you catch yourself wanting `palette.x` inside a screen, the token you
 * actually need is missing — add it to `color` rather than reaching past it.
 */

// ---------------------------------------------------------------------------
// Layer 1 — the raw palette
// ---------------------------------------------------------------------------

/**
 * Brand colours from the "Loane Brand Strategy Visuals" deck, page 2.
 *
 * The deck printed hex codes that did not match its own swatches for three
 * of the five. Zack confirmed we use the values sampled from the swatches;
 * those three stay marked TODO-CONFIRM until a designer supplies exact ones.
 */
export const palette = {
  // Brand
  /** Warm off-white. Deck hex matched the swatch. */
  cream: '#FFFFF2',
  /** Primary brand accent. Deck hex matched the swatch. */
  maroon: '#6F0C27',
  /** Ella's confirmed brand accent: Pantone 14-0445 TCX Bright Chartreuse. */
  brightChartreuse: '#B5BF50',
  /** TODO-CONFIRM: sampled (deck printed #b8406e, a pink). */
  gold: '#D6B04D',
  /** TODO-CONFIRM: sampled (deck printed #180c04, a near-black brown). */
  terracotta: '#B5784C',
  /** TODO-CONFIRM: sampled (deck printed #d57296, a pink). */
  sage: '#B8C7C2',

  // Neutrals, darkest to lightest.
  black: '#000000',
  ink900: '#111111',
  ink600: '#6B6B6B',
  ink400: '#9B9B9B',
  ink300: '#B0B0B0',
  grey300: '#CFCFCF',
  grey200: '#E5E5E5',
  grey100: '#EFEFEF',
  grey50: '#F7F7F5',
  white: '#FFFFFF',

  // Status
  green700: '#1F7A4D',
  amber700: '#B8860B',
  red700: '#B3261E',

  /**
   * Translucent blacks.
   *
   * The only colours in Loane that are not opaque, and they exist for
   * one reason: a label or a dimmed backdrop has to work on top of an
   * arbitrary photograph, and no flat surface colour does that. A price
   * on a white dress and a price on a black dress need the same chip.
   *
   * Deliberately few. Two weights of scrim and one shadow; if a fourth
   * is ever needed, it probably wants to be one of these instead.
   */
  scrim65: 'rgba(0, 0, 0, 0.65)',
  scrim35: 'rgba(0, 0, 0, 0.35)',
  shadow35: 'rgba(0, 0, 0, 0.35)',
} as const;

// ---------------------------------------------------------------------------
// Layer 2 — named by purpose
// ---------------------------------------------------------------------------

export const color = {
  text: {
    primary: palette.ink900,
    secondary: palette.ink600,
    muted: palette.ink400,
    /** On a dark background, e.g. the primary button label. */
    inverse: palette.white,
    disabled: palette.ink300,
    error: palette.red700,
  },

  surface: {
    /** The page background. */
    page: palette.white,
    /** A card or sheet sitting on the page. */
    raised: palette.white,
    /** A quietly shaded block — image placeholders, pressed rows. */
    muted: palette.grey50,
    /** Filled dark, e.g. an active chip. */
    inverse: palette.black,
    disabled: palette.grey100,
  },

  border: {
    /** The hairline used almost everywhere. */
    default: palette.grey200,
    strong: palette.grey300,
    /** A focused input. */
    focus: palette.ink900,
    /** Selected tabs and small active indicators. */
    accent: palette.brightChartreuse,
    inverse: palette.black,
    error: palette.red700,
  },

  /** Glyphs and icons, which are pure black in the mockups. */
  icon: {
    default: palette.black,
    muted: palette.ink400,
    inverse: palette.white,
  },

  button: {
    /**
     * The primary action is chartreuse, because the primary action is
     * where the brand should be loudest — "Request to rent", "Publish
     * look", "Continue". Label is black: #B5BF50 is a light yellow-green
     * and carries dark text only.
     */
    primary: { background: palette.brightChartreuse, label: palette.black },
    /**
     * Black. For a primary action that should NOT feel celebratory —
     * submitting a report about another student, mainly. Same weight on
     * the screen, none of the brand's enthusiasm.
     */
    dark: { background: palette.black, label: palette.white },
    outline: { background: palette.white, border: palette.black, label: palette.black },
    disabled: { background: palette.grey100, label: palette.ink300 },
  },

  status: {
    success: palette.green700,
    warning: palette.amber700,
    error: palette.red700,
  },

  brand: {
    cream: palette.cream,
    maroon: palette.maroon,
    brightChartreuse: palette.brightChartreuse,
    gold: palette.gold,
    terracotta: palette.terracotta,
    sage: palette.sage,
  },

  /**
   * The brand accent, for anything small and active: a selected chip, an
   * unread badge, a price tag, a chosen date, the tab you are on.
   *
   * `label` is black and there is deliberately no "accent text on white"
   * token. #B5BF50 on white is about 1.9:1 contrast — unreadable as text
   * and barely visible as a glyph. Chartreuse is always a BACKGROUND with
   * black on top of it, never ink.
   */
  accent: {
    background: palette.brightChartreuse,
    border: palette.brightChartreuse,
    label: palette.black,
  },

  /**
   * The dot beside a campus name. Real campuses carry their own
   * `brandColor` in Firestore — USC's is garnet. This is the fallback for a
   * campus that has not set one. We use a school's colour, never its logo,
   * which is trademarked.
   */
  campus: { dotFallback: palette.ink900 },

  /**
   * Sitting on top of a photograph.
   *
   * `onPhoto` is the chip behind a price or a counter laid over an
   * image — it has to stay readable whether the dress underneath is
   * white or black. `behindPanel` dims the screen behind the side
   * menu. `textOnPhoto` is the shadow that keeps the double-tap heart
   * visible on a pale photo.
   */
  scrim: {
    onPhoto: palette.scrim65,
    behindPanel: palette.scrim35,
  },
  shadow: {
    textOnPhoto: palette.shadow35,
  },
} as const;

// ---------------------------------------------------------------------------
// Type scale
// ---------------------------------------------------------------------------

/**
 * Raw sizes. Screens should use `type.*` below, not these — the named
 * roles are what keep two screens from drifting a point apart.
 */
export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 22,
  '3xl': 26,
  '4xl': 32,
  /** The tappable stars on a review form. */
  '5xl': 38,
  /** The heart that flashes up when you double tap a photo. */
  '6xl': 96,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Named text roles. `size` is a number so React Native can use it directly. */
export const type = {
  h1: { size: fontSize['4xl'], lineHeight: 38, weight: fontWeight.bold },
  h2: { size: fontSize['3xl'], lineHeight: 32, weight: fontWeight.bold },
  h3: { size: fontSize.xl, lineHeight: 26, weight: fontWeight.semibold },
  /** Default body copy. */
  body: { size: fontSize.lg, lineHeight: 24, weight: fontWeight.regular },
  bodySmall: { size: fontSize.md, lineHeight: 21, weight: fontWeight.regular },
  /** Small uppercase letter-spaced label, e.g. "SIGN IN TO YOUR CLOSET". */
  label: { size: 12, lineHeight: 16, weight: fontWeight.medium, letterSpacing: 1.4 },
  /** The floor. Tab labels, stat captions. Nothing smaller than this. */
  caption: { size: fontSize.xs, lineHeight: 14, weight: fontWeight.medium, letterSpacing: 1 },
  button: { size: fontSize.md, lineHeight: 20, weight: fontWeight.semibold, letterSpacing: 1.2 },
} as const;

// ---------------------------------------------------------------------------
// Space, shape and size
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  /** Standard left/right page gutter. */
  screenPadding: 24,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  thick: 2,
} as const;

/**
 * Icon sizes. Sized against what a real social app uses — Instagram's tab
 * icons sit around 26–28pt — so nothing reads as undersized on a phone.
 */
export const iconSize = {
  sm: 18,
  /** Top bar: hamburger, search, settings. */
  md: 26,
  /** The back chevron, and anything else wanting a large glyph. */
  lg: 28,
  /**
   * Bottom tab bar.
   *
   * Deliberately its own size rather than sharing `lg` with the back
   * chevron: a tab icon is the only thing on its row, is aimed at with
   * a thumb rather than read, and was undersized against the 92pt bar
   * it sits in.
   */
  tab: 31,
} as const;

/**
 * Control sizing. `minTapTarget` is Apple's recommended minimum; every
 * button and icon in the app must meet it, using hit slop where the glyph
 * itself is smaller.
 */
export const controls = {
  minTapTarget: 44,
  buttonHeight: 56,
  buttonHeightSmall: 44,
  inputHeight: 48,
  /**
   * Bottom tab bar CONTENT height, excluding the home-indicator safe
   * area. The layout adds `insets.bottom` on top of this.
   *
   * It was 92, which was this number plus a hard-coded guess at an
   * iPhone's home indicator — so on a notched phone the bar was right by
   * accident and the icons still crowded the indicator, and on a phone
   * with a home button it was 30pt of empty space.
   */
  tabBarHeight: 60,
  headerHeight: 56,
  /** Single-line rounded chip, e.g. the occasion filters on Discover. */
  chipHeight: 34,
  /** Square thumbnail in a photo grid. */
  thumbnail: 88,
} as const;

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

/**
 * The real brand faces are Tenorite Bold (headings) and Telegraf (body).
 * Tenorite is a Microsoft font not licensed for app embedding and Telegraf
 * is a paid licence, so we ship free stand-ins behind these token names.
 * Swapping in the licensed files later touches one file.
 */
export const fonts = {
  heading: 'LoaneHeading',
  body: 'LoaneBody',
  label: 'LoaneBody',
} as const;

/** TODO-FONTS: replace with licensed Tenorite Bold / Telegraf files. */
export const fontPlaceholders = {
  heading: 'Archivo Bold (stand-in for Tenorite Bold)',
  body: 'Inter (stand-in for Telegraf)',
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
  palette,
  color,
  type,
  fontSize,
  fontWeight,
  fonts,
  spacing,
  radius,
  borderWidth,
  iconSize,
  controls,
  taglines,
} as const;
