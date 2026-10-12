/**
 * Bottoms retest, on the real presets.
 *
 * Phase 0 kept bottoms out: they desaturated and bled colour at the
 * hem. Two things have changed since, and both could matter —
 * `segmentation_free: false`, which fixed the dress-over-trousers
 * failure, and real lay-it-flat product shots instead of photographs
 * of bottoms being worn.
 *
 * Four bottoms on both presets. The question is not "is it perfect"
 * but "would a student believe this and rent from it".
 *
 *   FASHN_API_KEY=... npx tsx scripts/tryOnBottomsTest.ts
 *
 * 8 generations, about $0.60.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const API_KEY = process.env.FASHN_API_KEY;
if (!API_KEY) throw new Error('No FASHN_API_KEY. See backend/functions/.env.');

const IMAGES = join(__dirname, 'seed-images');
const PRESETS = join(__dirname, '..', 'assets', 'tryon-presets');
const OUT_DIR = process.env.OUT_DIR ?? join(tmpdir(), 'loane-bottoms');

const BOTTOMS = [
  { file: 'demo-jeans.jpg', label: 'straight-leg-jeans' },
  { file: 'demo-denimshorts.jpg', label: 'frayed-denim-shorts' },
  { file: 'demo-sweatshorts.jpg', label: 'grey-sweat-shorts' },
  { file: 'demo-ginghamshorts.jpg', label: 'gingham-ruffle-shorts' },
];

const uri = (p: string) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;

async function run(modelImage: string, garmentPath: string): Promise<string> {
  const submit = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: modelImage,
        garment_image: uri(garmentPath),
        category: 'bottoms',
        garment_photo_type: 'flat-lay',
        mode: 'balanced',
        // Exactly what generateTryOn sends today.
        segmentation_free: false,
        moderation_level: 'conservative',
        return_base64: true,
        output_format: 'jpeg',
      },
    }),
  });
  const submitted = (await submit.json()) as { id?: string; error?: unknown };
  if (!submit.ok || !submitted.id) throw new Error(`submit ${submit.status}`);

  for (let i = 0; i < 90; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`https://api.fashn.ai/v1/status/${submitted.id}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const body = (await res.json()) as { status: string; output?: string[]; error?: unknown };
    if (body.status === 'completed') {
      const image = body.output?.[0];
      if (!image) throw new Error('no output');
      return image.startsWith('data:') ? image.slice(image.indexOf(',') + 1) : image;
    }
    if (body.status === 'failed') throw new Error(`failed ${JSON.stringify(body.error)}`);
  }
  throw new Error('timed out');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let n = 0;
  for (const preset of ['female', 'male']) {
    const body = uri(join(PRESETS, `${preset}.jpg`));
    for (const b of BOTTOMS) {
      process.stderr.write(`${preset} / ${b.label} … `);
      try {
        const out = await run(body, join(IMAGES, b.file));
        n += 1;
        writeFileSync(join(OUT_DIR, `${preset}__${b.label}.jpg`), Buffer.from(out, 'base64'));
        process.stderr.write('ok\n');
      } catch (err) {
        process.stderr.write(`FAILED — ${err instanceof Error ? err.message : err}\n`);
      }
    }
  }
  console.warn(`\n${n} generations, $${((n * 7.5) / 100).toFixed(2)}.\nImages: ${OUT_DIR}`);
}

void main();
