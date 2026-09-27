/**
 * Turns the shared brand tokens into React Native styles.
 *
 * The tokens themselves live in `@loane/shared` so the admin dashboard uses
 * exactly the same values. This file is only the React Native translation.
 */

import { StyleSheet } from 'react-native';
import { colors, controls, icons, radii, spacing, typography } from '@loane/shared';

export { colors, controls, icons, radii, spacing, typography };

/**
 * The small uppercase letter-spaced label used all over the mockups —
 * "SIGN IN TO YOUR CLOSET", "CREATE YOUR ACCOUNT", "BROWSE & BORROW".
 */
export const label = {
  fontSize: typography.label.size,
  lineHeight: typography.label.lineHeight,
  letterSpacing: typography.label.letterSpacing,
  textTransform: 'uppercase' as const,
  color: colors.textSecondary,
};

export const text = StyleSheet.create({
  h1: {
    fontSize: typography.h1.size,
    lineHeight: typography.h1.lineHeight,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  h2: {
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  h3: {
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textPrimary,
  },
  bodyMuted: {
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: colors.textSecondary,
  },
  small: {
    fontSize: typography.bodySmall.size,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    letterSpacing: typography.caption.letterSpacing,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  label,
  link: {
    fontSize: typography.body.size,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
});

export const layout = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  padded: {
    paddingHorizontal: spacing.screenPadding,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hairlineBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
