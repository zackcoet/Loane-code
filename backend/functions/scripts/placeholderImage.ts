/**
 * Generates real placeholder images for the seed.
 *
 * The seed used to store a single 1x1 pixel and claim it was 600x800.
 * Stretched across a card that is a flat grey smear, which is
 * indistinguishable from an image failing to load — so the whole app
 * looked broken on a real phone when it was working fine.
 *
 * These are proper PNGs at a sensible size, each a different colour
 * with a lighter band across the middle, so a grid of them reads as a
 * grid of different things rather than one grey wall. Still obviously
 * placeholders; nobody will mistake them for clothes.
 *
 * Written by hand rather than pulling in an image library: a PNG of a
 * few flat bands is about thirty lines, and the seed should not need a
 * dependency to draw a rectangle.
 */

import { deflateSync } from 'node:zlib';

/** CRC-32, which every PNG chunk needs. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

type Rgb = [number, number, number];

/** Nudges a colour towards white, for the band. */
function lighten([r, g, b]: Rgb, amount: number): Rgb {
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
}

/**
 * A `data:` PNG, `width` x `height`, in `color`, with a lighter
 * horizontal band across the middle third.
 */
export function placeholderImage(color: Rgb, width = 600, height = 800): string {
  const band = lighten(color, 0.18);
  const bandStart = Math.floor(height * 0.38);
  const bandEnd = Math.floor(height * 0.62);

  // Raw scanlines: one filter byte (0 = none) then RGB per pixel.
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const [r, g, b] = y >= bandStart && y < bandEnd ? band : color;
    const rowStart = y * stride;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = rowStart + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * A spread of muted, clothes-ish colours. Deliberately not the brand
 * palette — these are stand-ins for photographs, not for Loane.
 */
export const PLACEHOLDER_COLORS: Rgb[] = [
  [124, 106, 98],
  [148, 128, 140],
  [96, 112, 116],
  [160, 138, 112],
  [110, 122, 104],
  [138, 110, 110],
  [104, 108, 130],
  [150, 146, 132],
  [118, 96, 104],
  [132, 140, 148],
];

/** Same item, same colour, every run. */
export function colorFor(index: number): Rgb {
  return PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]!;
}
