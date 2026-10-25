/**
 * `checkPhoto`
 *
 * A quick look at a photo before we keep it, by Claude Haiku with
 * vision.
 *
 * THE PHOTO IS NOT STORED ANYWHERE TO BE CHECKED. It arrives as base64
 * in the request, goes to Anthropic, and is gone when the function
 * returns. A body photo that fails never lands in Storage at all,
 * which is the whole reason the check happens here rather than after
 * the upload.
 *
 * IT FAILS OPEN, DELIBERATELY. A missing key, a timeout, a bad JSON
 * reply, Anthropic being down — all of it lets the photo through. This
 * is a helper that saves her a wasted try-on, not a gate. A student
 * blocked from using the feature because a third party had a bad
 * afternoon is a far worse outcome than one blurry body photo.
 *
 * Cost is about $0.002 a check — roughly a fortieth of the $0.075 a
 * generation costs, so it pays for itself the first time it stops one
 * wasted try-on.
 */

import { type CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from '../lib/callable';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { invalidArgument } from '../lib/errors';
import { requireVerifiedStudent } from '../lib/guards';

/**
 * Set with:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY --project loane-code
 *
 * Locally the emulator reads it from backend/functions/.env.
 */
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const MODEL = 'claude-haiku-4-5-20251001';
const API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/** Anthropic rejects anything larger; the app sends ~1024px anyway. */
const MAX_BASE64_BYTES = 5 * 1024 * 1024;

/** A slow check is worse than no check — she is waiting on it. */
const TIMEOUT_MS = 15_000;

export type PhotoKind = 'body' | 'flat';

interface Input {
  kind?: PhotoKind;
  /** Raw base64, no data: prefix. */
  imageBase64?: string;
  mediaType?: string;
}

export interface PhotoCheckResult {
  ok: boolean;
  /** One friendly, specific sentence telling her what to change. */
  fix: string | null;
  /** True when we could not check at all and let it through. */
  skipped: boolean;
}

const PROMPTS: Record<PhotoKind, string> = {
  body: `You are checking a photo a college student is about to use for a virtual clothing try-on. The try-on puts garments onto her body, so the photo has to work for that.

Check ALL of these:
- Her whole body is visible, head to feet. Feet cut off is the most common problem.
- Exactly one person is in the photo.
- She is standing and facing the camera, not sitting, lying down, or turned away.
- The background is reasonably plain and uncluttered.
- There is enough light to see her clearly.
- She is wearing normal clothes — not underwear, swimwear, or nude.

Reply with ONLY a JSON object, no other text:
{"ok": true} if every check passes.
{"ok": false, "fix": "..."} if any fails.

"fix" must be ONE short, friendly, specific sentence telling her exactly what to change, addressed to her directly. Name the actual problem. Examples of the right tone:
"Your feet are cut off — step back so your whole body fits."
"There are two people in this one — we need just you."
"It's a bit dark to see you clearly — try somewhere brighter."
"Try a plainer wall behind you so the clothes show up properly."
Never scold, never mention AI or models, never use the word "invalid".`,

  flat: `You are checking a photo a college student is about to attach to a clothing listing. It is meant to be a "lay it flat" photo: the single garment she is renting out, laid flat on a plain surface, so a virtual try-on can put that exact garment onto someone.

Check ALL of these:
- EXACTLY ONE garment is in the photo. More than one piece, a rail of clothes, a full outfit, or accessories like shoes or a bag in frame all fail. This is the most important check.
- The whole garment is visible, not cropped.
- The background is plain and uncluttered.
- There is enough light to see the garment and its colour clearly.
- It is not underwear or swimwear.

Reply with ONLY a JSON object, no other text:
{"ok": true} if every check passes.
{"ok": false, "fix": "..."} if any fails.

"fix" must be ONE short, friendly, specific sentence telling her exactly what to change, addressed to her directly. Name the actual problem. Examples of the right tone:
"There's more than one piece in this photo — lay out just the one you're listing."
"The shoes in the corner will confuse the try-on — take them out of frame."
"Part of the hem is cut off — move back so the whole piece fits."
"Try a plain surface like a bed or a floor so the colour reads properly."
Never scold, never mention AI or models, never use the word "invalid".`,
};

/** Lets it through, and says why it could not check. */
function letThrough(reason: string, detail?: unknown): PhotoCheckResult {
  logger.warn('Photo check skipped', { reason, detail });
  return { ok: true, fix: null, skipped: true };
}

/**
 * The check itself, callable from another function.
 *
 * Exported so `prepareFlatPhoto` can run the same check before paying
 * FASHN to cut a background out — two copies of these prompts would
 * drift, and the one that drifted would be the one nobody tested.
 */
export async function runPhotoCheck(
  kind: PhotoKind,
  imageBase64: string,
  mediaType = 'image/jpeg',
): Promise<PhotoCheckResult> {
  if (imageBase64.length > MAX_BASE64_BYTES) {
    // Not her problem to solve: let it through rather than asking her
    // to understand a size limit.
    return letThrough('image too large', imageBase64.length);
  }

  const key = ANTHROPIC_API_KEY.value();
  if (!key) return letThrough('ANTHROPIC_API_KEY is not set');

  let body: { content?: { type: string; text?: string }[] };
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              { type: 'text', text: PROMPTS[kind] },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return letThrough(`anthropic returned ${response.status}`, await response.text());
    }
    body = (await response.json()) as typeof body;
  } catch (error) {
    return letThrough('anthropic call failed', (error as Error)?.message);
  }

  const text = body.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) return letThrough('no text in the reply');

  try {
    // Tolerant of a model that wraps JSON in prose or a code fence,
    // because the alternative is blocking her over punctuation.
    const match = /\{[\s\S]*\}/.exec(text);
    if (!match) return letThrough('no JSON in the reply', text);

    const parsed = JSON.parse(match[0]) as { ok?: unknown; fix?: unknown };
    if (parsed.ok === true) return { ok: true, fix: null, skipped: false };
    if (parsed.ok === false) {
      const fix = typeof parsed.fix === 'string' && parsed.fix.trim() ? parsed.fix.trim() : null;
      // A failure we cannot explain is not a failure we should act
      // on: "no" with no reason is the most frustrating screen there is.
      if (!fix) return letThrough('rejected with no reason given', text);
      return { ok: false, fix, skipped: false };
    }
    return letThrough('reply had no ok field', text);
  } catch (error) {
    return letThrough('could not parse the reply', (error as Error)?.message);
  }
}

export const checkPhoto = onCall<Input, Promise<PhotoCheckResult>>(
  { region: 'us-central1', secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60, memory: '512MiB' },
  async (request: CallableRequest<Input>) => {
    await requireVerifiedStudent(request);

    const kind = request.data?.kind;
    const imageBase64 = request.data?.imageBase64;
    if (kind !== 'body' && kind !== 'flat') throw invalidArgument('What kind of photo?');
    if (!imageBase64) throw invalidArgument('No photo to check.');

    return runPhotoCheck(kind, imageBase64, request.data?.mediaType ?? 'image/jpeg');
  },
);
