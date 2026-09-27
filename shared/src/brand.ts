/**
 * DEPRECATED — the old flat token names.
 *
 * Everything here is an alias for a token in `tokens.ts`, kept so that
 * `admin/` keeps compiling while Codex works on it in a separate worktree.
 * Values are identical; only the names changed.
 *
 * TODO-REMOVE: delete this file when the admin-dashboard branch is merged
 * and admin/ has been moved onto `color.*` / `type.*`. New code must import
 * from `tokens.ts` — the lint rule in .eslintrc.json will reject a raw hex
 * or font size, but it cannot stop you reaching for these old names, so
 * don't.
 */

import {
  borderWidth,
  color,
  controls,
  fontPlaceholders,
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
  taglines,
  type,
} from './tokens';

/** @deprecated Use `color.*` from tokens.ts. */
export const colors = {
  cream: color.brand.cream,
  maroon: color.brand.maroon,
  gold: color.brand.gold,
  terracotta: color.brand.terracotta,
  sage: color.brand.sage,

  black: palette.black,
  white: palette.white,
  ink: color.text.primary,
  textPrimary: color.text.primary,
  textSecondary: color.text.secondary,
  textMuted: color.text.muted,
  border: color.border.default,
  borderStrong: color.border.strong,
  surface: color.surface.raised,
  surfaceMuted: color.surface.muted,
  disabled: color.surface.disabled,
  disabledText: color.text.disabled,

  campusDotFallback: color.campus.dotFallback,

  success: color.status.success,
  warning: color.status.warning,
  danger: color.status.error,
} as const;

/** @deprecated Use `type.*` from tokens.ts. */
export const typography = type;
/** @deprecated Use `radius` from tokens.ts. */
export const radii = radius;
/** @deprecated Use `borderWidth` from tokens.ts. */
export const borders = borderWidth;
/** @deprecated Use `iconSize` from tokens.ts. */
export const icons = iconSize;

export { controls, fontPlaceholders, fonts, spacing, taglines };

/** @deprecated Import the specific token group you need. */
export const brand = {
  name: 'Loane',
  website: 'https://joinloane.com',
  supportEmail: 'team@joinloane.com',
  colors,
  fonts,
  typography: type,
  icons: iconSize,
  controls,
  spacing,
  radii: radius,
  borders: borderWidth,
  taglines,
} as const;
