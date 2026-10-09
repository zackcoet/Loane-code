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
 * Brand colours, from the 2026-10 brand deck.
 *
 * This deck SUPERSEDES the September one. It replaces chartreuse and
 * settles the three colours that sat marked TODO-CONFIRM for a month
 * because the old deck's printed hexes disagreed with its own swatches.
 * Nothing here is provisional.
 *
 * Every ratio below is measured against Cream, which is the canvas.
 */
export const palette = {
  // --- Primary, 90% of the app -------------------------------------------
  /** The canvas. Every screen sits on this, not on white. */
  cream: '#F6EFE4',
  /** The voice: headings, icons, the mark. 11.0:1 on cream. */
  merlot: '#5E1A2E',
  /** The wink: the primary action. 4.9:1 on cream, 5.6:1 under white. */
  cherry: '#C8213F',

  // --- Secondary accents --------------------------------------------------
  //
  // BACKGROUNDS ONLY, always under near-black text. On cream they measure
  // 1.19:1, 1.59:1 and 2.69:1 — as ink or a glyph they are invisible,
  // which is the exact mistake chartreuse made. Behind dark text they are
  // 13.9:1, 10.4:1 and 6.1:1 and perfectly readable.
  butter: '#F7DC7A',
  ballet: '#EFAFC2',
  denim: '#7F95B0',

  // Midnight (#1A2D4D) is in the deck but marked campaign only, so it is
  // deliberately absent. Add it here if that ever changes.

  // --- Neutrals, warmed toward the brand ----------------------------------
  //
  // Not greys. A true grey next to cream reads as dirty, so the whole
  // ramp is pulled slightly toward merlot's hue.
  /** Body text. Warm near-black with a merlot lean. 15.3:1 on cream. */
  ink900: '#231619',
  /** Secondary text. 5.5:1 on cream — still passes for body copy. */
  ink600: '#6B5E52',
  /** Muted text. 4.5:1, right at the threshold. */
  ink400: '#7A6B5E',
  /** Disabled and placeholder. 3.4:1 — large text and glyphs only. */
  ink300: '#8A7F72',
  grey300: '#D3C6B2',
  grey200: '#E2D8C8',
  grey100: '#EDE5D9',
  /** A quietly shaded block on the cream canvas. */
  grey50: '#EFE7DB',
  black: '#000000',
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
    /** Warm near-black, not pure black: a true black beside cream looks
        like a hole punched in the page. 15.3:1. */
    primary: palette.ink900,
    secondary: palette.ink600,
    muted: palette.ink400,
    /** On merlot, cherry, or a photograph. */
    inverse: palette.white,
    disabled: palette.ink300,
    error: palette.cherry,
    /** Headings and the wordmark. Merlot is the brand's voice. */
    heading: palette.merlot,
  },

  surface: {
    /** The canvas. Cream, never white — this is the single biggest thing
        that makes the app look like the deck. */
    page: palette.cream,
    /** A card or sheet. WHITE on purpose, so it lifts off the cream. */
    raised: palette.white,
    /** A quietly shaded block — image placeholders, pressed rows. */
    muted: palette.grey50,
    /** Filled dark, e.g. a pressed state that must read as solid. */
    inverse: palette.merlot,
    disabled: palette.grey100,
  },

  border: {
    /** The hairline used almost everywhere. */
    default: palette.grey200,
    strong: palette.grey300,
    /** A focused input. */
    focus: palette.merlot,
    /** Selected tabs and small active indicators. */
    accent: palette.butter,
    inverse: palette.merlot,
    error: palette.cherry,
  },

  /** Glyphs and icons. Merlot, which is the brand's voice. */
  icon: {
    default: palette.merlot,
    muted: palette.ink400,
    inverse: palette.white,
  },

  button: {
    /**
     * The primary action is CHERRY with a white label — 5.6:1.
     *
     * Cherry is the deck's "wink": the one colour allowed to interrupt.
     * It belongs on the thing we most want tapped, and nowhere that
     * would dilute it.
     */
    primary: { background: palette.cherry, label: palette.white },
    /**
     * Merlot. For a primary action that should NOT feel celebratory —
     * submitting a report about another student, mainly. Same weight on
     * the screen, none of the brand's enthusiasm.
     */
    dark: { background: palette.merlot, label: palette.white },
    outline: { background: palette.cream, border: palette.merlot, label: palette.merlot },
    disabled: { background: palette.grey100, label: palette.ink300 },
  },

  status: {
    success: palette.green700,
    warning: palette.amber700,
    error: palette.cherry,
  },

  brand: {
    cream: palette.cream,
    merlot: palette.merlot,
    cherry: palette.cherry,
    butter: palette.butter,
    ballet: palette.ballet,
    denim: palette.denim,
  },

  /**
   * The quiet highlight: a price tag, a selected chip, a chosen date.
   *
   * BUTTER, not cherry. Two loud reds on one screen cancel each other
   * out — if a price tag shouts as loudly as "Request to rent", neither
   * one is the primary action any more. Butter is warm, calm, and
   * unmistakably not a button.
   *
   * `label` is near-black and there is deliberately NO "accent text"
   * token. Butter on cream is 1.19:1: invisible as ink, excellent as a
   * background. That is the same trap chartreuse fell into.
   */
  accent: {
    background: palette.butter,
    border: palette.butter,
    label: palette.ink900,
  },

  /**
   * Something that needs answering now: an unread badge, a "Your turn"
   * pill. Cherry, because this is the other thing worth interrupting
   * for, and it is rare enough not to compete with the buttons.
   */
  attention: {
    background: palette.cherry,
    border: palette.cherry,
    label: palette.white,
  },

  /**
   * The dot beside a campus name. Real campuses carry their own
   * `brandColor` in Firestore — USC's is garnet. This is the fallback for a
   * campus that has not set one. We use a school's colour, never its logo,
   * which is trademarked.
   */
  campus: { dotFallback: palette.merlot },

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
  /**
   * The serif. A hero headline, an onboarding line, an empty state —
   * the places the brand gets to speak rather than label.
   *
   * DM Serif Display has one weight, so `weight` here is regular and the
   * size does the work. Never use it for body copy.
   */
  display: { size: 34, lineHeight: 40, weight: fontWeight.regular },
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
 * Font family names, as registered in mobile/src/theme/fonts.ts.
 *
 * ONE NAME PER WEIGHT, deliberately. `fontWeight` is ignored for an
 * embedded font on Android and only approximated on iOS — each weight is
 * its own file and must be asked for by name. Use `fontFamilyFor()`
 * rather than setting a family and a weight and hoping.
 */
export const fonts = {
  /** Figtree 400. Body copy. */
  body: 'LoaneBody',
  /** Figtree 500. Small uppercase labels. */
  medium: 'LoaneBodyMedium',
  /** Figtree 600. Buttons. */
  semibold: 'LoaneBodySemibold',
  /** Figtree 700. Headings. */
  heading: 'LoaneHeading',
  /**
   * DM Serif Display 400. The big moments only — a hero headline, an
   * onboarding line, an empty state. It has one weight and no italic,
   * so it is not a body face and must never be asked to be one.
   */
  display: 'LoaneDisplay',
} as const;

/** The Figtree family carrying a given numeric weight. */
export function fontFamilyFor(weight: string): string {
  if (weight === '700') return fonts.heading;
  if (weight === '600') return fonts.semibold;
  if (weight === '500') return fonts.medium;
  return fonts.body;
}

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
