import { Ionicons } from '@expo/vector-icons';
import { color, iconSize } from '@loane/shared';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  name: IconName;
  size?: number;
  tint?: string;
}

export function Icon({ name, size = iconSize.md, tint = color.icon.default }: Props) {
  return <Ionicons name={name} size={size} color={tint} />;
}
