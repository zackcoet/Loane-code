/**
 * @loane/shared — the single source of truth for Loane's data models,
 * domain constants, brand tokens and validation.
 *
 * mobile, admin and backend/functions all import from here. If you find
 * yourself redefining a type or repeating a magic string, it belongs in
 * this package instead.
 */

export * from './types';
export * from './constants';
// The canonical design tokens. Everything new imports from here.
export * from './tokens';
// Deprecated flat aliases, kept only until admin/ is migrated.
export { colors, typography, radii, borders, icons } from './brand';
export * from './collections';
export * from './money';
export * from './dates';
export * from './validation';
