/**
 * One icon component, almost always Ionicons.
 *
 * ONE SET, WITH A SHORT LIST OF EXCEPTIONS. Mixing icon families is
 * how an app ends up with three different ideas of what a line weight
 * is. Ionicons is the set; anything else has to be named here, on
 * purpose, with a reason.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { color, iconSize } from '@loane/shared';
import type { ComponentProps } from 'react';

/**
 * Glyphs Ionicons simply does not have.
 *
 *   hanger — the Activity tab. Ella's note: a heart there competed
 *            with the heart that saves something, and two hearts
 *            meaning different things on one screen is a coin toss.
 *            Ionicons has no hanger, and MaterialCommunityIcons draws
 *            one at a line weight that sits beside the others.
 *
 * Deliberately a hard-coded map rather than an escape hatch: adding to
 * it is a decision somebody has to write down.
 */
const MATERIAL = {
  hanger: 'hanger',
} as const satisfies Record<string, ComponentProps<typeof MaterialCommunityIcons>['name']>;

type MaterialName = keyof typeof MATERIAL;

export type IconName = ComponentProps<typeof Ionicons>['name'] | MaterialName;

interface Props {
  name: IconName;
  size?: number;
  tint?: string;
}

const isMaterial = (name: IconName): name is MaterialName => name in MATERIAL;

export function Icon({ name, size = iconSize.md, tint = color.icon.default }: Props) {
  if (isMaterial(name)) {
    return <MaterialCommunityIcons name={MATERIAL[name]} size={size} color={tint} />;
  }
  return <Ionicons name={name} size={size} color={tint} />;
}
