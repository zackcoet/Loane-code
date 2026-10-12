/**
 * The FASHN client.
 *
 * FASHN direct rather than a reseller, and the reason is privacy, not
 * price: fal.ai resells the identical model at the identical price and
 * adds a second company holding photographs of students' bodies, with
 * self-serve accounts that retain generations indefinitely. See
 * docs/decisions.md.
 *
 * PHOTOS REACH FASHN ONLY FROM HERE. Never from the app, never from a
 * public URL. They go up as base64, whose temporary copy FASHN deletes
 * when the request finishes.
 */

import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { internal } from '../lib/errors';

/**
 * Set with:
 *   firebase functions:secrets:set FASHN_API_KEY --project loane-code
 *
 * Locally the emulator reads it from backend/functions/.env. Never in
 * the repo, never pasted into a chat. Any function that calls FASHN
 * must list this in its `secrets` option or the value is simply absent
 * at runtime.
 */
export const FASHN_API_KEY = defineSecret('FASHN_API_KEY');

const API = 'https://api.fashn.ai/v1';

/** Phase 0 measured ~8.5s per generation in this mode. */
const MODE = 'balanced';

/** 2s ticks for up to 3 minutes — well past anything still going to succeed. */
const POLL_MS = 2000;
const POLL_ATTEMPTS = 90;

/** FASHN's three categories. Ours map onto these via TRYON_CATEGORY_MAP. */
export type FashnCategory = 'tops' | 'bottoms' | 'one-pieces';

export interface TryOnRequest {
  /** Data URI or https URL of the body. */
  modelImage: string;
  /** Data URI of the garment's flat photo. */
  garmentImage: string;
  category: FashnCategory;
}

function key(): string {
  const value = FASHN_API_KEY.value();
  if (!value) {
    // A missing secret is a deploy mistake, not a user mistake, so it
    // says nothing useful to her and everything useful to the log.
    logger.error('FASHN_API_KEY is not set. Run firebase functions:secrets:set.');
    throw internal('Try-on is temporarily unavailable.');
  }
  return value;
}

/**
 * One generation. Returns raw base64 of the resulting JPEG.
 *
 * Layering is this called twice, feeding the first result in as the
 * second call's `modelImage` — which is also why the caller, not this,
 * owns the ordering.
 */
export async function runTryOn(input: TryOnRequest): Promise<string> {
  const authorization = `Bearer ${key()}`;

  const submit = await fetch(`${API}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify({
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: input.modelImage,
        garment_image: input.garmentImage,
        category: input.category,
        // The flat-photo gate guarantees this. A listing without a flat
        // photo never reaches here.
        garment_photo_type: 'flat-lay',
        mode: MODE,
        // Blocks underwear and swimwear at the service. The category map
        // is the real control; this is the backstop for a mis-tagged
        // listing. Both, deliberately.
        moderation_level: 'conservative',
        return_base64: true,
        output_format: 'jpeg',
      },
    }),
  });

  const submitted = (await submit.json()) as { id?: string; error?: unknown };
  if (!submit.ok || !submitted.id) {
    logger.error('FASHN submit failed', { status: submit.status, error: submitted.error });
    throw internal('Could not start that try-on. Try again.');
  }

  for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));

    const res = await fetch(`${API}/status/${submitted.id}`, {
      headers: { Authorization: authorization },
    });
    const body = (await res.json()) as {
      status: string;
      output?: string[];
      error?: unknown;
    };

    if (body.status === 'completed') {
      const image = body.output?.[0];
      if (!image) {
        logger.error('FASHN completed with no output', { id: submitted.id });
        throw internal('That try-on came back empty. Try again.');
      }
      return image.startsWith('data:') ? image.slice(image.indexOf(',') + 1) : image;
    }

    if (body.status === 'failed') {
      // Moderation rejections land here too, which is why the message
      // does not promise that retrying will help.
      logger.error('FASHN generation failed', { id: submitted.id, error: body.error });
      throw internal('That one could not be generated.');
    }
  }

  logger.error('FASHN timed out', { id: submitted.id });
  throw internal('That took too long. Try again.');
}
