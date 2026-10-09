/**
 * React Native style helpers built from the shared design tokens.
 *
 * The tokens themselves live in `@loane/shared/tokens` so the admin
 * dashboard uses exactly the same values. This file is only the React
 * Native translation — it must never introduce a new colour or size.
 */

import { StyleSheet } from 'react-native';
import {
  color,
  controls,
  fontFamilyFor,
  fonts,
  iconSize,
  radius,
  spacing,
  type,
} from '@loane/shared';

export { color, controls, fonts, iconSize, radius, spacing, type };

/**
 * The small uppercase letter-spaced label used all over the mockups —
 * "SIGN IN TO YOUR CLOSET", "CREATE YOUR ACCOUNT", "BROWSE & BORROW".
 */
export const label = {
  fontFamily: fontFamilyFor(type.label.weight),
  fontSize: type.label.size,
  lineHeight: type.label.lineHeight,
  letterSpacing: type.label.letterSpacing,
  textTransform: 'uppercase' as const,
  color: color.text.secondary,
};

export const text = StyleSheet.create({
  h1: {
    fontFamily: fontFamilyFor('700'),
    fontSize: type.h1.size,
    lineHeight: type.h1.lineHeight,
    fontWeight: '700',
    color: color.text.primary,
  },
  h2: {
    fontFamily: fontFamilyFor('700'),
    fontSize: type.h2.size,
    lineHeight: type.h2.lineHeight,
    fontWeight: '700',
    color: color.text.primary,
  },
  h3: {
    fontFamily: fontFamilyFor('600'),
    fontSize: type.h3.size,
    lineHeight: type.h3.lineHeight,
    fontWeight: '600',
    color: color.text.primary,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
    color: color.text.primary,
  },
  bodyMuted: {
    fontFamily: fonts.body,
    fontSize: type.body.size,
    lineHeight: type.body.lineHeight,
    color: color.text.secondary,
  },
  small: {
    fontFamily: fonts.body,
    fontSize: type.bodySmall.size,
    lineHeight: type.bodySmall.lineHeight,
    color: color.text.secondary,
  },
  caption: {
    fontFamily: fontFamilyFor(type.caption.weight),
    fontSize: type.caption.size,
    lineHeight: type.caption.lineHeight,
    letterSpacing: type.caption.letterSpacing,
    textTransform: 'uppercase',
    color: color.text.muted,
  },
  label,
  /** The serif. Hero headlines and onboarding lines only. */
  display: {
    fontFamily: fonts.display,
    fontSize: type.display.size,
    lineHeight: type.display.lineHeight,
    color: color.text.heading,
  },
  link: {
    fontFamily: fonts.body,
    fontSize: type.body.size,
    color: color.text.primary,
    textDecorationLine: 'underline',
  },
});

export const layout = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface.page },
  padded: { paddingHorizontal: spacing.screenPadding },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  hairlineBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border.default,
  },
});
