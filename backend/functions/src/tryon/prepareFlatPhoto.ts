/**
 * `prepareFlatPhoto`
 *
 * Turns a lender's photo of a garment into the thing a try-on can
 * actually use: one piece, cut out, on nothing.
 *
 * ONE CALL, TWO STEPS, IN THIS ORDER:
 *
 *   1. The same AI check the body photo gets — one garment, whole
 *      piece, plain background. If it fails she is told what to change
 *      and NOTHING IS SPENT.
 *   2. Only then, FASHN's background-remove, which costs a credit.
 *
 * The order is the whole design. Background removal is $0.075 — the
 * same price as a generation — so paying for it on a photo of a
 * clothes rail would be paying to cut out the wrong garment. The check
 * is $0.002, so it pays for itself the first time in forty that it
 * stops one.
 *
 * WHY REMOVE THE BACKGROUND AT ALL, having decided not to in the
 * research: that decision was about photos the gate had ALREADY
 * passed, where there was no quality to buy. This is different — it is
 * the lender's own bedroom floor, and a cutout is what makes a
 * student's phone photo look like the product shots the demo garments
 * are. It happens ONCE per listing, not once per try-on, which is why
 * the cost argument lands the other way.
 */

import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { invalidArgument } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';
import { ANTHROPIC_API_KEY, runPhotoCheck } from './checkPhoto';
import { FASHN_API_KEY } from './fashn';

const API = 'https://api.fashn.ai/v1';
/** Background removal is 1-3 seconds; this is a long way past that. */
const POLL_ATTEMPTS = 30;
const POLL_MS = 1000;

/** Anthropic's ceiling, and well past anything the app sends. */
const MAX_BASE64_BYTES = 5 * 1024 * 1024;

interface Input {
  imageBase64?: string;
}

export interface PrepareFlatPhotoResult {
  ok: boolean;
  /** What to change, when the check says no. */
  fix: string | null;
  /** The cut-out garment as base64 PNG, when it worked. */
  imageBase64: string | null;
  /** True when the cutout failed and the original is being used as-is. */
  usedOriginal: boolean;
}

export const prepareFlatPhoto = onCall<Input, Promise<PrepareFlatPhotoResult>>(
  {
    region: 'us-central1',
    secrets: [ANTHROPIC_API_KEY, FASHN_API_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request: CallableRequest<Input>) => {
    await requireVerifiedStudent(request);

    const imageBase64 = request.data?.imageBase64;
    if (!imageBase64) throw invalidArgument('No photo to prepare.');
    if (imageBase64.length > MAX_BASE64_BYTES) throw invalidArgument('That photo is too large.');

    // --- 1. Is it a photo of one garment at all? -------------------------
    const check = await runPhotoCheck('flat', imageBase64);
    if (!check.ok) {
      return { ok: false, fix: check.fix, imageBase64: null, usedOriginal: false };
    }

    // --- 2. Cut it out ----------------------------------------------------
    const key = FASHN_API_KEY.value();
    if (!key) {
      // No key is a deploy mistake. Her photo passed the check, so it
      // is a perfectly good flat photo as it stands — using it beats
      // telling her to try again at something she did correctly.
      logger.error('FASHN_API_KEY is not set; using the original photo.');
      return { ok: true, fix: null, imageBase64, usedOriginal: true };
    }

    try {
      const submit = await fetch(`${API}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model_name: 'background-remove',
          inputs: { image: `data:image/jpeg;base64,${imageBase64}`, return_base64: true },
        }),
      });

      const submitted = (await submit.json()) as { id?: string; error?: unknown };
      if (!submit.ok || !submitted.id) {
        logger.error('Background remove submit failed', { status: submit.status });
        return { ok: true, fix: null, imageBase64, usedOriginal: true };
      }

      for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const res = await fetch(`${API}/status/${submitted.id}`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        const body = (await res.json()) as { status: string; output?: string[]; error?: unknown };

        if (body.status === 'completed') {
          const image = body.output?.[0];
          if (!image) break;
          return {
            ok: true,
            fix: null,
            imageBase64: image.startsWith('data:')
              ? image.slice(image.indexOf(',') + 1)
              : image,
            usedOriginal: false,
          };
        }
        if (body.status === 'failed') {
          logger.error('Background remove failed', { error: body.error });
          break;
        }
      }
    } catch (error) {
      logger.error('Background remove threw', { error: (error as Error)?.message });
    }

    /*
      EVERY FAILURE PATH KEEPS HER PHOTO. It already passed the check,
      so it is a usable flat photo — a cutout makes it look better, it
      does not make it work. Throwing away a good photo because our
      second service had a bad minute would be our problem becoming
      hers.
    */
    return { ok: true, fix: null, imageBase64, usedOriginal: true };
  },
);
