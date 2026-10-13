/**
 * The Loane mark: two filled circles overlapping in butter.
 *
 * A light ballet circle with a ballet ring, a cherry circle with a
 * merlot ring, and the lens where they cross is butter — the third
 * colour neither circle has on its own. It replaced the two hairline
 * outline rings in October 2026.
 *
 * DRAWN, NOT AN IMAGE, so it stays crisp behind a 28pt header and at
 * 104pt on the welcome screen without shipping six PNGs. The artwork
 * is brand/logo-flat.svg and the icons are cut from the same geometry
 * by brand/generate-brand.py; OVERLAP and RING below are the same two
 * numbers that file uses, and they have to stay the same two numbers.
 *
 * THE LENS IS A REAL INTERSECTION, not a leaf shape drawn by eye: the
 * right circle, clipped to the left one. Anything else fails to sit on
 * both edges at once and looks wrong at large sizes.
 *
 * Two lockups:
 *
 *   mark   the circles alone — the loader, the + sheet, small headers
 *   below  the circles with LOANE letter-spaced underneath
 *
 * There is no longer a lockup with the letters sitting ON the circles.
 * The old mark was two outlines, so letters could sit inside them; on
 * filled circles L and O land on cherry and vanish, and the three
 * colours already carry the brand without help. `across` is kept as a
 * name so older screens keep working, and resolves to `below`.
 */

import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { color, fonts } from '@loane/shared';

/** Below this diameter the wordmark is dropped unless asked for. */
const WORDMARK_INSIDE_MIN = 64;

/**
 * How far one circle sits over the other, as a fraction of a diameter.
 * Tuned against Ella's reference on the outline mark and kept: it is
 * what makes the butter lens wide enough to be a shape rather than a
 * seam.
 */
export const OVERLAP = 0.38;

/** Ring weight, as a fraction of a diameter. */
export const RING = 0.045;

const LETTER_WEIGHT = '700' as const;

export interface MarkGeometry {
  diameter: number;
  overlap: number;
  /** The pair's bounding box. */
  width: number;
  ring: number;
}

export function markGeometry(diameter: number): MarkGeometry {
  return {
    diameter,
    overlap: diameter * OVERLAP,
    width: diameter * (2 - OVERLAP),
    // Never thinner than 2pt, or the rings disappear in a 28pt header.
    ring: Math.max(2, Math.round(diameter * RING)),
  };
}

/**
 * The five pieces the mark is made of, as plain styles.
 *
 * Exported because LoaneLoader animates them individually — the two
 * circles slide together and the butter arrives last — and the loader
 * must not end up holding a second copy of this geometry.
 *
 * Paint order is fills, lens, then BOTH rings on top, so each circle
 * reads as a whole circle crossing the other rather than one being cut
 * off by the other's fill.
 */
export function markPieces(size: number) {
  const g = markGeometry(size);
  const { diameter, overlap, ring } = g;
  const rightLeft = diameter - overlap;

  const disc: ViewStyle = {
    position: 'absolute',
    top: 0,
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
  };

  return {
    geometry: g,
    wrap: { width: g.width, height: diameter } satisfies ViewStyle,
    leftFill: { ...disc, left: 0, backgroundColor: color.logo.leftFill },
    rightFill: { ...disc, left: rightLeft, backgroundColor: color.logo.rightFill },
    /**
     * The clip. A view the exact shape of the left circle with
     * `overflow: hidden`, holding a butter circle positioned where the
     * right one is — so what survives is precisely the intersection.
     */
    lensClip: { ...disc, left: 0, overflow: 'hidden' } satisfies ViewStyle,
    lensCircle: {
      ...disc,
      left: rightLeft,
      backgroundColor: color.logo.overlap,
    } satisfies ViewStyle,
    leftRing: { ...disc, left: 0, borderWidth: ring, borderColor: color.logo.leftRing },
    rightRing: {
      ...disc,
      left: rightLeft,
      borderWidth: ring,
      borderColor: color.logo.rightRing,
    },
  };
}

type Lockup = 'auto' | 'mark' | 'below' | 'across';

interface Props {
  /** Diameter of one circle, in points. */
  size?: number;
  lockup?: Lockup;
  /**
   * The wordmark's colour. NOT the mark's: the circles are three fixed
   * brand colours and tinting them would make it a different logo.
   */
  wordmarkTint?: string;
}

export function Logo({ size = 96, lockup = 'auto', wordmarkTint = color.logo.wordmark }: Props) {
  const p = markPieces(size);
  const resolved: Lockup =
    lockup === 'auto' ? (size >= WORDMARK_INSIDE_MIN ? 'below' : 'mark') : lockup;

  const mark = (
    <View style={p.wrap} accessibilityRole="image" accessibilityLabel="Loane">
      <View style={p.leftFill} />
      <View style={p.rightFill} />
      <View style={p.lensClip}>
        <View style={p.lensCircle} />
      </View>
      <View style={p.leftRing} />
      <View style={p.rightRing} />
    </View>
  );

  if (resolved === 'mark') return mark;

  return (
    <View style={styles.stack}>
      {mark}
      <Text
        style={[
          styles.wordmark,
          // Size only; styles.wordmark carries the family. The wordmark
          // scales with the mark, so this cannot be a constant.
          // eslint-disable-next-line no-restricted-syntax
          { fontSize: Math.max(11, size * 0.34), color: wordmarkTint },
        ]}
      >
        LOANE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center' },
  wordmark: {
    fontFamily: fonts.heading,
    marginTop: 6,
    letterSpacing: 3,
    fontWeight: LETTER_WEIGHT,
  },
});
