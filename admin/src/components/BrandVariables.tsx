import { colors } from '@loane/shared';

const cssVariables = Object.entries(colors)
  .map(([name, value]) => `--loane-${kebab(name)}: ${value};`)
  .join('\n');

export function BrandVariables() {
  return <style>{`:root {\n${cssVariables}\n}`}</style>;
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
