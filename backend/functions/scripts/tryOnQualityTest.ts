/**
 * Phase 0 quality test for AI virtual try-on (FASHN v1.6).
 *
 * This is a RESEARCH script, not product code. It answers one question:
 * is the output good enough to put in front of a student?
 *
 * It runs a fixed matrix of cases against our own seeded listing photos
 * — the good ones AND the deliberately bad ones (racks, flat-lays with
 * shoes and handbags in frame) — so we learn what makes results worse
 * before we design the upload flow around it.
 *
 * Images go up as base64 data URIs rather than public URLs. FASHN keeps
 * submitted URLs in its request history indefinitely but deletes the
 * temporary copy of a base64 input when the request finishes. For a
 * script handling photographs of people, that is the right default, and
 * it is the same reasoning we will apply in the real Cloud Function.
 *
 *   FASHN_API_KEY=... npx tsx scripts/tryOnQualityTest.ts
 *
 * Optional: OUT_DIR=/some/path   MODE=performance|balanced|quality
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const API_KEY = process.env.FASHN_API_KEY;
if (!API_KEY) {
  console.error(
    'No FASHN_API_KEY in the environment.\n' +
      'Set it in backend/functions/.env.tryon (gitignored) and run with:\n' +
      '  set -a && . .env.tryon && set +a && npx tsx scripts/tryOnQualityTest.ts',
  );
  process.exit(1);
}

const MODE = (process.env.MODE ?? 'balanced') as 'performance' | 'balanced' | 'quality';
const OUT_DIR = process.env.OUT_DIR ?? join(tmpdir(), 'loane-tryon');
const IMAGES = join(__dirname, 'seed-images');

/** FASHN bills one credit per successful generation. $0.075 on-demand. */
const COST_PER_GENERATION_CENTS = 7.5;

type Category = 'tops' | 'bottoms' | 'one-pieces' | 'auto';

/** A body to dress. */
interface Body {
  id: string;
  file: string;
  label: string;
}

/** A garment, with how honest a photo it is. */
interface Garment {
  id: string;
  file: string;
  label: string;
  category: Category;
  /** 'clean' = one garment, plain background. 'busy' = what we actually expect. */
  quality: 'clean' | 'busy';
  photoType: 'flat-lay' | 'model' | 'auto';
}

const BODIES: Body[] = [
  {
    id: 'her-photo',
    file: 'person-05.jpg',
    label: 'Her own photo (stand-in): full body, outdoors, plain-ish background',
  },
  {
    id: 'preset-model',
    file: 'person-10.jpg',
    label: 'Preset model (stand-in): studio, plain backdrop, cropped at the thigh',
  },
];

const GARMENTS: Garment[] = [
  // The clean end: one garment, hanger or flat-lay, nothing else in frame.
  { id: 'poncho', file: 'garment-04.jpg', label: 'Cream fringed poncho, on a hanger', category: 'tops', quality: 'clean', photoType: 'flat-lay' },
  { id: 'bomber', file: 'garment-12.jpg', label: 'Rust bomber jacket, held on a hanger', category: 'tops', quality: 'clean', photoType: 'flat-lay' },
  { id: 'chambray', file: 'garment-14.jpg', label: 'Chambray shirt, flat-lay', category: 'tops', quality: 'clean', photoType: 'flat-lay' },
  { id: 'trousers', file: 'garment-13.jpg', label: 'Pink paperbag trousers, worn, head cropped off', category: 'bottoms', quality: 'clean', photoType: 'model' },
  { id: 'romper', file: 'garment-15.jpg', label: 'Olive romper, flat-lay', category: 'one-pieces', quality: 'clean', photoType: 'flat-lay' },
  { id: 'wrap-dress', file: 'garment-07.jpg', label: 'Floral wrap dress, worn on a beach', category: 'one-pieces', quality: 'busy', photoType: 'model' },

  // The messy end: what a student's camera roll actually looks like.
  { id: 'rack-white', file: 'garment-01.jpg', label: 'A whole rail of clothes', category: 'tops', quality: 'busy', photoType: 'auto' },
  { id: 'flatlay-outfit', file: 'garment-06.jpg', label: 'Flat-lay: trousers, tee, trainers and a watch together', category: 'bottoms', quality: 'busy', photoType: 'flat-lay' },
  { id: 'jeans-shelf', file: 'garment-10.jpg', label: 'A shop shelf of jeans', category: 'bottoms', quality: 'busy', photoType: 'auto' },
  { id: 'jacket-and-jeans', file: 'garment-03.jpg', label: 'A jacket, a top and jeans hanging together', category: 'tops', quality: 'busy', photoType: 'auto' },
];

const byId = (id: string) => {
  const g = GARMENTS.find((x) => x.id === id);
  if (!g) throw new Error(`no garment ${id}`);
  return g;
};

/** One row of the report: a body, one or two garments, and the result. */
interface Case {
  name: string;
  body: Body;
  /** Run in order. More than one means layering: each output feeds the next. */
  garments: Garment[];
  asks: string;
}

const CASES: Case[] = [
  { name: 'top-alone-clean', body: BODIES[0]!, garments: [byId('poncho')], asks: 'A top on its own, best-case photo' },
  { name: 'top-alone-jacket', body: BODIES[1]!, garments: [byId('bomber')], asks: 'A structured jacket on the preset model' },
  { name: 'bottoms-alone', body: BODIES[0]!, garments: [byId('trousers')], asks: 'Bottoms on their own' },
  { name: 'dress-flatlay', body: BODIES[1]!, garments: [byId('romper')], asks: 'A one-piece from a flat-lay' },
  { name: 'dress-onbody', body: BODIES[0]!, garments: [byId('wrap-dress')], asks: 'A dress photographed on someone else — the formal-rental case' },
  { name: 'layered-outfit', body: BODIES[0]!, garments: [byId('chambray'), byId('trousers')], asks: 'Top then bottoms, layered — does the top survive?' },
  { name: 'busy-rack', body: BODIES[0]!, garments: [byId('rack-white')], asks: 'A whole rail — which garment does it even pick?' },
  { name: 'busy-flatlay', body: BODIES[1]!, garments: [byId('flatlay-outfit')], asks: 'A flat-lay with shoes and a watch in frame' },
  { name: 'busy-shelf', body: BODIES[0]!, garments: [byId('jeans-shelf')], asks: 'A shop shelf of jeans' },
  { name: 'busy-multi', body: BODIES[1]!, garments: [byId('jacket-and-jeans')], asks: 'Three garments hanging together' },
];

function dataUri(file: string): string {
  return `data:image/jpeg;base64,${readFileSync(join(IMAGES, file)).toString('base64')}`;
}

interface RunResult {
  image: string;
  ms: number;
}

async function runTryOn(modelImage: string, garment: Garment): Promise<RunResult> {
  const started = Date.now();

  const submit = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: modelImage,
        garment_image: dataUri(garment.file),
        category: garment.category,
        garment_photo_type: garment.photoType,
        mode: MODE,
        // Conservative blocks underwear and swimwear outright, which is
        // the rule we want anyway, and lets the service enforce it rather
        // than trusting our own category tagging.
        moderation_level: 'conservative',
        return_base64: true,
        output_format: 'jpeg',
      },
    }),
  });

  const submitted = (await submit.json()) as { id?: string; error?: unknown };
  if (!submit.ok || !submitted.id) {
    throw new Error(`submit failed (${submit.status}): ${JSON.stringify(submitted.error ?? submitted)}`);
  }

  // Poll. Balanced mode is ~8s, so a 2s tick wastes little and a 3 minute
  // ceiling is well past anything that is still going to succeed.
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
    if (body.status === 'failed') {
      throw new Error(`generation failed: ${JSON.stringify(body.error)}`);
    }
  }
  throw new Error('timed out after 3 minutes');
}

/** Strip a data URI down to raw base64, whatever form the output arrives in. */
function toBase64(image: string): string {
  return image.startsWith('data:') ? image.slice(image.indexOf(',') + 1) : image;
}

interface Row {
  c: Case;
  steps: { garment: Garment; ms: number; file: string }[];
  error?: string;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const rows: Row[] = [];
  let generations = 0;

  for (const c of CASES) {
    process.stderr.write(`${c.name} … `);
    const row: Row = { c, steps: [] };

    try {
      let current = dataUri(c.body.file);
      for (const garment of c.garments) {
        const { image, ms } = await runTryOn(current, garment);
        generations += 1;
        const b64 = toBase64(image);
        const file = `${c.name}--${garment.id}.jpg`;
        writeFileSync(join(OUT_DIR, file), Buffer.from(b64, 'base64'));
        row.steps.push({ garment, ms, file });
        // Layering is sequential: the dressed body becomes the next input.
        current = `data:image/jpeg;base64,${b64}`;
      }
      console.warn(`${row.steps.map((s) => `${(s.ms / 1000).toFixed(1)}s`).join(' + ')}`);
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      console.warn(`FAILED — ${row.error}`);
    }

    rows.push(row);
  }

  writeFileSync(join(OUT_DIR, 'report.html'), report(rows, generations));
  console.warn(
    `\n${generations} generations, ${(generations * COST_PER_GENERATION_CENTS / 100).toFixed(2)} USD at ` +
      `$${(COST_PER_GENERATION_CENTS / 100).toFixed(3)} each.\nReport: ${join(OUT_DIR, 'report.html')}`,
  );
}

function thumb(file: string, fromSeed: boolean): string {
  const b64 = fromSeed
    ? readFileSync(join(IMAGES, file)).toString('base64')
    : readFileSync(join(OUT_DIR, file)).toString('base64');
  return `<img src="data:image/jpeg;base64,${b64}" alt="">`;
}

function report(rows: Row[], generations: number): string {
  const body = rows
    .map((r) => {
      const inputs = [
        `<figure>${thumb(r.c.body.file, true)}<figcaption>${r.c.body.label}</figcaption></figure>`,
        ...r.c.garments.map((g) => `<figure>${thumb(g.file, true)}<figcaption>${g.label}<br><small>${g.quality} · ${g.category}</small></figcaption></figure>`),
      ].join('');

      const outputs = r.error
        ? `<p class="fail">Failed: ${r.error}</p>`
        : r.steps
            .map(
              (s, i) =>
                `<figure>${thumb(s.file, false)}<figcaption>step ${i + 1}: ${s.garment.label}<br><small>${(s.ms / 1000).toFixed(1)}s · $${(COST_PER_GENERATION_CENTS / 100).toFixed(3)}</small></figcaption></figure>`,
            )
            .join('');

      return `<section><h2>${r.c.name}</h2><p>${r.c.asks}</p>
        <div class="row"><div class="side"><h3>In</h3><div class="imgs">${inputs}</div></div>
        <div class="side"><h3>Out</h3><div class="imgs">${outputs}</div></div></div></section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Try-on quality test</title><style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #fff; color: #231619; margin: 0; padding: 32px; }
  h1 { font-size: 28px; } h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .08em; color: #5E1A2E; }
  section { border-top: 1px solid #e7e0d8; padding: 24px 0; }
  .row { display: flex; gap: 32px; flex-wrap: wrap; }
  .side h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #8a7f78; }
  .imgs { display: flex; gap: 12px; flex-wrap: wrap; }
  figure { margin: 0; width: 200px; } img { width: 200px; border: 1px solid #e7e0d8; display: block; }
  figcaption { font-size: 12px; margin-top: 6px; line-height: 1.4; } small { color: #8a7f78; }
  .fail { color: #C8213F; }
</style></head><body>
<h1>Virtual try-on — Phase 0 quality test</h1>
<p>FASHN try-on v1.6, <strong>${MODE}</strong> mode. ${generations} generations,
<strong>$${(generations * COST_PER_GENERATION_CENTS / 100).toFixed(2)}</strong> total.
Bodies and garments are our own seeded photos.</p>
${body}</body></html>`;
}

void main();
