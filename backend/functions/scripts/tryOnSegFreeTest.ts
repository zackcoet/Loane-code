/**
 * A/B: `segmentation_free` true vs false.
 *
 * FASHN's try-on defaults this to TRUE — it fits the garment without
 * first segmenting away what she is already wearing. Their own
 * guidance is to set it FALSE when original garments are not removed
 * properly.
 *
 * That is, word for word, the Phase 0 failure we recorded as
 * unfixable: the floral wrap dress that rendered beautifully with
 * yellow joggers poking out below the hem. We had been sending the
 * default without ever trying the alternative.
 *
 * Four cases, each run both ways. Two are the known failures, and TWO
 * ARE CONTROLS — a clean top and a clean one-piece that already work.
 * A change that fixes the dress and quietly ruins the poncho is not an
 * improvement, and without controls we would not see it.
 *
 *   FASHN_API_KEY=... npx tsx scripts/tryOnSegFreeTest.ts
 *
 * 8 generations, about $0.60.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const API_KEY = process.env.FASHN_API_KEY;
if (!API_KEY) {
  throw new Error('No FASHN_API_KEY in the environment. See backend/functions/.env.');
}

const IMAGES = join(__dirname, 'seed-images');
const OUT_DIR = process.env.OUT_DIR ?? join(tmpdir(), 'loane-segfree');
const COST_PER_GENERATION_CENTS = 7.5;

type Category = 'tops' | 'bottoms' | 'one-pieces';

interface Step {
  file: string;
  category: Category;
  photoType: 'flat-lay' | 'model';
  label: string;
}

interface Case {
  name: string;
  /** The body. person-05 is wearing trousers — which is the point. */
  body: string;
  steps: Step[];
  asks: string;
  control: boolean;
}

const CASES: Case[] = [
  {
    name: '1-dress-over-trousers',
    body: 'person-05.jpg',
    steps: [
      {
        file: 'garment-07.jpg',
        category: 'one-pieces',
        photoType: 'model',
        label: 'Floral wrap dress',
      },
    ],
    asks: 'THE failure: a dress over a body wearing trousers left the trousers on.',
    control: false,
  },
  {
    name: '2-layered-top-then-bottoms',
    body: 'person-05.jpg',
    steps: [
      { file: 'garment-14.jpg', category: 'tops', photoType: 'flat-lay', label: 'Chambray shirt' },
      {
        file: 'garment-13.jpg',
        category: 'bottoms',
        photoType: 'model',
        label: 'Pink paperbag trousers',
      },
    ],
    asks: 'Layering: the trousers desaturated and bled orange at the hem.',
    control: false,
  },
  {
    name: '3-control-poncho',
    body: 'person-05.jpg',
    steps: [
      { file: 'garment-04.jpg', category: 'tops', photoType: 'flat-lay', label: 'Cream poncho' },
    ],
    asks: 'CONTROL — already good. Must not get worse.',
    control: true,
  },
  {
    name: '4-control-romper',
    body: 'person-10.jpg',
    steps: [
      {
        file: 'garment-15.jpg',
        category: 'one-pieces',
        photoType: 'flat-lay',
        label: 'Olive romper',
      },
    ],
    asks: 'CONTROL — already good. Must not get worse.',
    control: true,
  },
];

function dataUri(file: string): string {
  return `data:image/jpeg;base64,${readFileSync(join(IMAGES, file)).toString('base64')}`;
}

async function runTryOn(
  modelImage: string,
  step: Step,
  segmentationFree: boolean,
): Promise<{ image: string; ms: number }> {
  const started = Date.now();

  const submit = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: modelImage,
        garment_image: dataUri(step.file),
        category: step.category,
        garment_photo_type: step.photoType,
        mode: 'balanced',
        // THE VARIABLE UNDER TEST. Everything else matches what
        // generateTryOn sends in production.
        segmentation_free: segmentationFree,
        moderation_level: 'conservative',
        return_base64: true,
        output_format: 'jpeg',
      },
    }),
  });

  const submitted = (await submit.json()) as { id?: string; error?: unknown };
  if (!submit.ok || !submitted.id) {
    throw new Error(`submit failed (${submit.status}): ${JSON.stringify(submitted.error)}`);
  }

  for (let i = 0; i < 90; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`https://api.fashn.ai/v1/status/${submitted.id}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const body = (await res.json()) as { status: string; output?: string[]; error?: unknown };
    if (body.status === 'completed') {
      const image = body.output?.[0];
      if (!image) throw new Error('completed with no output');
      return { image, ms: Date.now() - started };
    }
    if (body.status === 'failed') throw new Error(`failed: ${JSON.stringify(body.error)}`);
  }
  throw new Error('timed out');
}

const toBase64 = (image: string) =>
  image.startsWith('data:') ? image.slice(image.indexOf(',') + 1) : image;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let generations = 0;

  for (const c of CASES) {
    for (const segFree of [true, false]) {
      const tag = segFree ? 'A-segfree-TRUE-current' : 'B-segfree-FALSE-new';
      process.stderr.write(`${c.name} / ${tag} … `);
      try {
        let current = dataUri(c.body);
        for (const step of c.steps) {
          const { image } = await runTryOn(current, step, segFree);
          generations += 1;
          current = `data:image/jpeg;base64,${toBase64(image)}`;
        }
        writeFileSync(
          join(OUT_DIR, `${c.name}__${tag}.jpg`),
          Buffer.from(toBase64(current), 'base64'),
        );
        process.stderr.write('ok\n');
      } catch (err) {
        process.stderr.write(`FAILED — ${err instanceof Error ? err.message : String(err)}\n`);
      }
    }
  }

  console.warn(
    `\n${generations} generations, $${((generations * COST_PER_GENERATION_CENTS) / 100).toFixed(2)}.\n` +
      `Images: ${OUT_DIR}`,
  );
}

void main();
