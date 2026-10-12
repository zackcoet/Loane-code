/**
 * Importing an image gives you an opaque asset handle.
 *
 * React Native's bundler rewrites a static image import into something
 * it can resolve at runtime. TypeScript has to be told, and this
 * cannot go in expo-env.d.ts — that file is generated and gitignored,
 * so it would vanish on a fresh checkout and the build would break for
 * the next person rather than for whoever added the import.
 *
 * Typed as ImageSourcePropType rather than `number` so the type says
 * what it is for.
 */
declare module '*.jpg' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}

declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
