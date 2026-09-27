/**
 * Publishes the shared design tokens to CSS as custom properties, so
 * `styles.css` can use them without a second copy of the palette living
 * here.
 *
 * `color.text.primary` becomes `--loane-text-primary`,
 * `color.button.primary.background` becomes
 * `--loane-button-primary-background`, and so on. Nested groups are
 * flattened with hyphens.
 *
 * This is the only bridge between the tokens and the stylesheet. If a
 * colour is missing from the CSS, add it to `color` in
 * shared/src/tokens.ts — not here, and not as a literal in the CSS.
 */

import { color, fontSize, radius, spacing } from '@loane/shared';

type Tokens = Record<string, unknown>;

/** { text: { primary: '#111' } } -> { 'text-primary': '#111' } */
function flatten(input: Tokens, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const name = prefix ? `${prefix}-${kebab(key)}` : kebab(key);
    if (value && typeof value === 'object') {
      Object.assign(out, flatten(value as Tokens, name));
    } else {
      out[name] = String(value);
    }
  }
  return out;
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const variables = {
  ...flatten(color),
  ...flatten(spacing as Tokens, 'space'),
  ...flatten(radius as Tokens, 'radius'),
  ...flatten(fontSize as Tokens, 'font'),
};

const css = Object.entries(variables)
  .map(([name, value]) => {
    // spacing/radius/font sizes are numbers; CSS needs units.
    const needsPx = /^(space|radius|font)-/.test(name) && /^\d+$/.test(value);
    return `  --loane-${name}: ${needsPx ? `${value}px` : value};`;
  })
  .join('\n');

export function BrandVariables() {
  return <style>{`:root {\n${css}\n}`}</style>;
}
