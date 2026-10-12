# AI Virtual Try-On — Phase 1 build plan

**Status: approved, not started. Queued behind growth Parts 1–5.**

This document is the brief for whoever builds it. Phase 0 — the research
and the quality test — is done and its results are below. Nothing has been
built. No app code has been touched.

The only artefact that exists is `backend/functions/scripts/tryOnQualityTest.ts`,
the quality harness, which is **uncommitted**. Keep it: it is how we re-test
bottoms before turning them on, and how we evaluate any replacement service.

---

## 1. What we settled, and why

### Zack's decisions, 2026-10-11

1. **The flat-photo gate is approved.** "Try it on" appears only on a listing
   that has a clean *lay it flat, just this piece* photo. Not a warning, not
   a disclaimer — the button is simply absent without one.
2. **Launch with Tops and Dresses only.** Bottoms show "Coming soon".
   *(Extended 2026-10-12: Outerwear is included too — it maps to FASHN's
   `tops` and tested well. Sets stay out until Bottoms.)*
3. **Before Bottoms are turned on**, re-run the quality test using flat
   garment photos *and* a body photo in fitted clothes. Both conditions, or
   the retest tells us nothing.
4. **The body-photo camera screen must say "wear fitted clothes".**

### The engineering decision behind them

**FASHN try-on v1.6, called directly — not through fal.ai.**

fal.ai resells the identical model at the identical price, but adds a second
company holding photographs of students' bodies, and fal's self-serve accounts
retain generations indefinitely. FASHN direct is one processor, with a written
promise not to train on our content and a parameter that shrinks how long they
hold an image. Google's Vertex `virtual-try-on-001` is 20% cheaper and we are
already a Google Cloud customer, which was genuinely tempting — but its docs do
not confirm bottoms or dresses, it has no equivalent of the on-body garment
parameter, and the model carries a published discontinuation date of
20 January 2027. Replicate's IDM-VTON, the cheap one everyone benchmarks, is
licensed non-commercial and cannot be shipped at all.

---

## 2. What Phase 0 actually proved

Eleven generations against our own seeded photos. $0.82. No failures.

| | |
|---|---|
| Typical generation | **8.5 seconds**, balanced mode |
| Cost | **$0.075** per generation, confirmed |
| A layered outfit | two calls — ~17s and $0.15 |
| Output ceiling | 864×1296. Fine on a phone, nothing more |

**One garment, plain background → genuinely good.** The cream poncho kept its
fringe, her pose and her hands. The rust bomber kept its zip, ribbed collar and
elasticated hem. The olive romper kept the ring hardware on its straps. A
student would believe these.

**More than one garment in frame → fails in two ways, and the quiet one is
worse.** Given a whole clothes rail, it silently picked one garment and
rendered it beautifully — she has no way to know she is looking at the wrong
dress. Given a shelf of jeans it produced shorts. Given a flat-lay with
trainers and a watch in frame it invented an unrelated outfit. Given three
garments on one hanger it produced a colour-blocked mess. Nine of our fifteen
seeded listing photos are in this category. **This is the entire reason for
the flat-photo gate.**

**Three findings that shape the build:**

- **Layering works; the second pass pays for it.** Chambray shirt, then
  trousers: the shirt survived, which was the thing most likely to break. But
  the trousers came out desaturated and bled orange at the hem where they met
  the bulky joggers underneath. The top is safe. Whatever goes on second is
  where quality is lost.
- **Bottoms are the weak category.** Desaturation and hem bleeding, both
  times. This is why they are not in the launch.
- **A dress over a body wearing trousers leaves the trousers on.** The floral
  wrap dress rendered beautifully with yellow joggers poking out below the
  hem. This is not a bug we can fix in code. It is why the camera screen has
  to ask for fitted clothes, and why that guidance belongs *on the camera*,
  not in a help article nobody reads.

---

## 3. Preset models

### The licensing answer: yes, we can own them

FASHN has a **`model-create`** API endpoint that generates a fashion model
from a text prompt. On ownership, their terms say:

> "As between you and FASHN, and to the extent permitted by applicable law,
> you own the outputs generated for you."

and that FASHN "assigns to you any rights it may have in those outputs", for
"personal or commercial purposes". They do not train on our content. So:
**we can generate the three presets, own them, and ship them.**

Three caveats that must be respected, not waved through:

- **No uniqueness guarantee.** Another customer could generate something
  similar. For three preset bodies in a rental app, that is an acceptable
  risk — they are furniture, not brand marks.
- **No IP-infringement guarantee.** FASHN explicitly does not promise an
  output infringes nobody. The mitigation is ours: generate from a text
  prompt only, review each one, and reject anything that reads as a
  recognisable person.
- **Never use `face_reference`.** The endpoint accepts a portrait to pin an
  identity across generations. Using it would mean basing a preset on a real
  person's face, which is exactly the thing we must not do. Prompt only.

Cost is trivial: 1–5 credits per image depending on mode and resolution, so
roughly $0.075–$0.375 each. Budget ~$10 for iterating to three we are happy
with.

### The three to generate

All three share a specification driven straight by the Phase 0 findings —
**fitted clothing is not a style choice, it is what stops dresses rendering
over trousers**:

> Full body, head to feet, standing square to camera, arms held slightly away
> from the body, feet slightly apart. Plain pale background, soft even
> light, no props, no shadow on the backdrop. Wearing a plain fitted neutral
> top and plain fitted neutral leggings. Natural relaxed expression, mouth
> closed. College-age, 18–22. Photographed as an ordinary person, not as a
> fashion model: no editorial posing, no styling, no heavy make-up.

Three bodies, varying across build and skin tone so the set reads as a campus
rather than a size chart:

| | Build | Notes for the prompt |
|---|---|---|
| **Preset A** | Small / petite | Shorter stature, slim build, deep brown skin, dark hair worn back off the shoulders |
| **Preset B** | Medium | Average build and height, olive/tan skin, mid-length brown hair worn back |
| **Preset C** | Plus | Fuller figure, size 18–20, fair skin, long blonde hair worn back |

**Hair worn back off the shoulders on all three** — hair over the shoulder is
the second most common thing that corrupts a try-on after a busy garment
photo, because the model has to decide whether it sits over or under the
garment.

Label them in the UI by build only — **Petite / Medium / Curve** — never by a
number, never by a name. They are not characters and should not be given one.

Generate them with `generation_mode: "quality"`, `resolution: "2k"`,
`aspect_ratio: "9:16"`, and **record the seed of each chosen image in this
document** so they can be regenerated identically if a file is ever lost.

**These are brand assets, not user content.** Store them in the repo under
`mobile/assets/tryon-presets/`, ship them in the bundle, and do not put them
in Storage. Three files that never change should not cost a network round
trip, and bundling them means the Try-On screen works before any upload.

---

## 4. The data model

### New collection: `tryOns`

`tryOns/{tryOnId}` — one generated image. **Private to its owner, always.**

```ts
interface TryOn extends BaseDoc {
  uid: string;

  /** Which body. 'own' means her own photo. */
  bodyKind: 'own' | 'preset';
  /** 'petite' | 'medium' | 'curve' when bodyKind is 'preset', else null. */
  presetId: PresetId | null;

  /**
   * The pieces, in the order they were applied. One entry today; two when
   * layering arrives. Order matters — it is how the result was built.
   */
  pieces: {
    listingId: string;
    /** Denormalized so a saved look renders without reading every listing. */
    name: string;
    coverUrl: string | null;
    ownerUid: string;
    category: Category;
  }[];

  /** Storage path. NOT a public URL. */
  imagePath: string;

  /**
   * The cache key. Same body + same pieces in the same order = same key,
   * so we never pay twice for an identical result. See below.
   */
  cacheKey: string;

  /** True once she taps Save look. Unsaved try-ons are swept after 7 days. */
  saved: boolean;
}
```

### The cache key

A SHA-256 of: the body identity, plus each piece's listing id **and the
updatedAt of that listing's flat photo**, in order.

Including the photo's timestamp is the part that matters. If a lender
replaces her flat photo, every cached result for that garment must miss —
otherwise students keep seeing a try-on of a garment photo that no longer
exists. A cache that serves stale images is worse than no cache.

For `bodyKind: 'own'`, the body identity is a hash of her body-photo Storage
path plus its upload timestamp, so retaking her photo invalidates her whole
cache. For presets, it is just the preset id, which means **preset results
are shareable across all users** — the same dress on Preset B is generated
once for the whole campus and served from cache forever after. That is a
large cost saving and it is the main argument for the presets existing at
all beyond accessibility.

### New fields on existing documents

On `Listing`:

```ts
  /**
   * The lay-it-flat photo. Its presence is what switches "Try it on" on
   * for this listing. Optional — a listing without one is still a perfectly
   * good listing, it just cannot be tried on.
   */
  flatPhoto: ImageRef | null;
```

On the private user document (`users/{uid}/private/settings`), **not the
public user document** — a body photo must never be denormalized into
anything another student can read:

```ts
  tryOn: {
    /** Storage path of her body photo, or null. */
    bodyPhotoPath: string | null;
    bodyPhotoUploadedAt: Timestampish | null;
    /** She ticked "This is a photo of me". Recorded, with when. */
    selfConfirmedAt: Timestampish | null;
  } | null;
```

### New constants in `@loane/shared`

```ts
export const TRYON_PRESETS = ['petite', 'medium', 'curve'] as const;

/**
 * Our categories mapped to FASHN's three. Anything absent from this map
 * cannot be tried on — which is how underwear and swimwear are blocked:
 * not by a filter, but by never being eligible in the first place.
 */
export const TRYON_CATEGORY_MAP = {
  tops: 'tops',
  // Outerwear is one of our categories but not one of FASHN's. It maps to
  // 'tops', and the rust bomber was the second-best result of the whole
  // Phase 0 test, so it launches alongside them. Zack's call, 2026-10-12.
  outerwear: 'tops',
  dresses: 'one-pieces',
} as const;

/** Shown with "Coming soon" rather than being silently absent. */
export const TRYON_COMING_SOON: Category[] = ['bottoms', 'shoes'];
```

---

## 5. Security — who may write what

The rule is unchanged: **never trust the phone.**

The app may write: nothing in `tryOns`. Not one field.

Only Cloud Functions may write: every `tryOn` document, `listing.flatPhoto`
(via the existing listing-edit path, which already validates), and the
`tryOn` block on her private settings.

She uploads two kinds of photo directly to Storage, because that is how every
other photo in Loane already works and a Cloud Function has no business
proxying an 8MB upload:

```
users/{uid}/tryon/body/{fileName}     — her body photo
users/{uid}/tryon/results/{fileName}  — generated results
```

**Both are owner-read. This is a new shape for this repo and must not be
copied from the rules above it.** Every existing Storage path is readable by
at least any signed-in student, because listing and post photos appear in
feeds. These two are not. The rule is:

```
match /users/{userId}/tryon/{kind}/{fileName} {
  allow read: if isOwner(userId);
  allow write: if isOwner(userId) && validUpload() && kind == 'body';
}
```

Results are written by the function via the Admin SDK, which bypasses rules —
so the app gets no write permission on them at all.

**Admins get nothing.** No admin read rule on either path, and no admin UI
that renders a body photo. If a damage claim or a report ever needs one, that
is a conversation to have then, with her consent, not a door we leave open.

---

## 6. Cloud Functions

Everything that costs money runs server-side. Three functions.

### `generateTryOn`

Callable. Input: `{ bodyKind, presetId, listingIds: string[] }`.

1. Check she is signed in and not suspended.
2. Check every listing exists, is not removed, **has a `flatPhoto`**, and is
   in `TRYON_CATEGORY_MAP`. Reject otherwise — the client hides the button,
   but the client is not to be trusted.
3. Build the cache key. **If a `tryOn` already exists with that key and is
   readable by her, return it and spend nothing.**
4. Phase 2 only: check and decrement her quota. Phase 1 has no limit — but
   write the function so the check has an obvious home, because retrofitting
   a quota around an existing call is how double-spends happen.
5. Resolve the body image: a preset file, or a signed URL for her body photo,
   valid 10 minutes.
6. Call FASHN once per piece, feeding each result into the next:
   `model_name: 'tryon-v1.6'`, `mode: 'balanced'`,
   `garment_photo_type: 'flat-lay'` (the gate guarantees this),
   `category` from the map, `moderation_level: 'conservative'`,
   `return_base64: true`.
7. Write the result to Storage, write the `tryOn` document, return it.

`moderation_level: 'conservative'` blocks underwear and swimwear at the
service. The category map blocks them at our end. Both, deliberately: the map
is the real control, the service setting is the backstop for a mis-tagged
listing.

Secret: **`FASHN_API_KEY`**, via `defineSecret`, exactly like
`STRIPE_SECRET_KEY` in `src/lib/stripe.ts`. It never reaches the app.

### `deleteTryOnData`

Callable, no arguments. Deletes her body photo, every `tryOn` document she
owns, and every result file. Clears the `tryOn` block on her private
settings. One tap from Settings, no confirmation beyond "Delete" — she should
never have to fight for this.

### `sweepUnsavedTryOns`

Scheduled daily. Deletes `tryOn` documents and files where `saved` is false
and `createdAt` is older than 7 days. Saved looks are kept until she deletes
them.

**This needs a composite index on `saved` + `createdAt`.** Write it into
`firestore.indexes.json` in the same commit as the function. The hourly
booking sweep crashed on a missing index from the day it was deployed and
nobody noticed for weeks, because the emulator does not enforce indexes.
Do not repeat that.

---

## 7. Screens

Shared components first — `Text`, `Button`, `Chip`, `Card`, `Header`,
`EmptyState`, `ComingSoon`, and **`LoaneLoader`**, which already exists and
is exactly the branded rings this feature was asking for. No raw colours, no
raw font sizes, every tap target at least 44pt.

### `mobile/app/try-on.tsx` — the Try-On screen

- The body photo fills the top of the screen.
- Below it, category tabs: **Tops · Dresses · Bottoms · Shoes**. Bottoms and
  Shoes render "Coming soon" — present but inert, so she can see where the
  feature is going.
- **Outerwear pieces appear under the Tops tab**, because that is what they
  map to at FASHN and because four live tabs for three categories is more
  navigation than the content deserves. If a separate Outerwear tab is
  wanted later it is a one-line change.
- Under the tabs, a horizontal row of eligible pieces drawn from her Saved
  items and her own closet. **Eligible means: has a flat photo, and is Tops,
  Outerwear or Dresses.** A piece without a flat photo does not appear here
  at all.
- Tapping a piece dresses the photo. `LoaneLoader` for the ~8 second wait,
  with a line of copy — the wait is long enough that a bare spinner reads as
  a hang.
- **Undo** steps back one piece. **Reset** returns to the bare body.
  **Save look** writes it.
- Under the result, one row per piece on it, each with its **Loane It** and
  **Own It** buttons carrying the price, matching the listing screen.

### `mobile/app/try-on-body.tsx` — choosing a body

- Three presets, labelled Petite / Medium / Curve.
- "Use my own photo", which opens the camera with an outline frame.
- **The camera guidance, in this order:** stand inside the outline · full
  body, head to feet · **wear fitted clothes — loose clothing shows through**
  · arms and legs slightly apart · plain wall behind you · good light.
  The fitted-clothes line is not optional and is not a footnote. It is the
  single highest-value instruction on the screen.
- **Before upload she must tick "This is a photo of me."** Not a pre-ticked
  box, not buried in a paragraph. The timestamp is recorded.
- Retake, anytime.

### Entry points

A **Try it on** button on: listing detail, Saved items, and her own closet
pieces — each shown **only when that listing has a flat photo**.

### `mobile/app/add-to-closet.tsx` and `edit-listing.tsx`

One new optional photo slot: **"Lay it flat — just this piece"**. The copy
has to earn it, because we are asking for work:

> One photo of just this piece, laid flat on a plain surface. This is what
> lets people try it on, and pieces people can try on get rented more.

Show the gate's effect live: a small line under the slot reading **"Try it on
is on for this piece"** once a flat photo is attached. A lender who can see
the switch flip will take the photo.

### `mobile/app/my-wishlist.tsx` — ⚠ a naming collision

**Saved already has a "Looks" tab, and it means saved posts.** The original
brief said saved try-ons go in "a new Looks section of Saved". That name is
taken and means something else entirely.

Add a **third tab: "My Try-Ons"**. Do not rename or overload the existing
Looks tab — a saved post is someone else's outfit she liked; a saved try-on
is her own body wearing a garment. Mixing them is both a privacy smell and a
usability one.

### `mobile/app/settings.tsx`

One row: **Delete my try-on photos**. Calls `deleteTryOnData`. States plainly
what goes: her body photo and every look she has saved.

---

## 8. Privacy — the non-negotiables

- Her body photo and every result are **private to her alone**. Never in the
  feed, never on her profile, never in search, never in a post, never visible
  to an admin.
- Nothing in `tryOns` is denormalized into any document another student can
  read. No counters, no previews, no "3 friends tried this on".
- **No sharing in Phase 1.** Not even a share sheet. If sharing is ever added
  it is a separate decision with its own consent, because an image of her
  body in someone else's dress is the most sensitive thing this app will ever
  hold.
- Photos reach FASHN **only from a Cloud Function**, as base64 or a 10-minute
  signed URL. The key lives in Firebase secrets.
- FASHN's written position: they do not use customer content to train,
  fine-tune or improve any model; a base64 input's temporary copy is deleted
  when the request finishes. That is the best available position in this
  market and the reason they were chosen.
- She confirms "This is a photo of me" before upload.
- She can delete everything in one tap.
- Categories outside `TRYON_CATEGORY_MAP` can never be tried on, which is how
  underwear and swimwear are excluded structurally rather than by a filter
  someone can forget to apply.

---

## 9. Events

Add to `EVENT_TYPES`:

```
tryon_open
tryon_generate
tryon_save
tryon_body_photo_set
tryon_body_photo_delete
```

Add `'tryon'` to `EVENT_SURFACES`.

**Do not invent a new event for the thing that matters.** When she taps
Loane It or Own It from a try-on, fire the existing `listing_view` with
`surface: 'tryon'`. That makes try-on → rental directly comparable with
feed → rental and post → rental, which is the second MVP question. A bespoke
event would sit outside every funnel we already have.

`tryon_generate` should record whether it was a cache hit, because the cache
hit rate is what decides whether Phase 2's economics work.

---

## 10. Built now so Phase 2 fits

Phase 2 is 5 free try-ons a week, $4.99 for 20 credits through Apple IAP, a
counter, and an admin on/off switch. **Do not build it in Phase 1.** But two
things must be right now or they are expensive later:

- The cache, exactly as specified. It is the whole cost model.
- An obvious, empty place in `generateTryOn` where the quota check goes.

A feature flag for the whole thing — off by default, on for our own accounts
— is cheap now and is what lets us ship the code before the presets are
signed off.

---

## 11. Not in Phase 1

Bottoms. Shoes. Sharing of any kind. Credits, quotas and purchases. The admin
dashboard. Try-on from a post's tagged pieces. More than two layers.

---

## 12. Settled since, and the one thing still open

**Settled by Zack, 2026-10-12:**

1. **Outerwear is in.** It maps to FASHN's `tops`. So the launch is Tops,
   Outerwear and Dresses — three of our categories, two of FASHN's.
2. **Sets stay out** until Bottoms arrive. A set is two garments sold
   together and has no clean FASHN equivalent; it is really a layering case
   wearing a different hat, so it waits for the pass that fixes layering.
3. **Zack and Ella sign off on the three presets** once generated, before
   they ship. They are brand assets every student will see, so do not bundle
   them until that has happened.

**Still open — for the build session, not for Zack:**

4. **A `docs/decisions.md` entry** for the flat-photo gate, choosing FASHN
   direct, and Tops-Outerwear-Dresses first. Not written here to avoid two
   sessions editing the same file. **The build session should add it before
   writing any code**, so the reasoning is recorded in the place people
   actually look for it rather than only in this plan.

---

## 13. For Terms v2 and the Privacy Policy

The feature adds all of the following, and none of it is covered today:

**Privacy Policy**

- That we collect a **photograph of her body**, what it is used for, and that
  it is private to her account.
- That body photos and try-on results are **shared with a named third-party
  AI processor, FASHN**, located outside her campus and possibly outside the
  US, for the sole purpose of generating the image.
- That FASHN does not train models on them, and how long each party keeps
  them: us until she deletes them, FASHN for the length of the request.
- Her **confirmation that the photo is of her**, and that uploading a photo
  of anyone else is a breach of the Terms.
- The **one-tap deletion right**, where it lives, and what it removes.
- That unsaved try-ons are **automatically deleted after 7 days**.
- That try-on usage is logged as events, and what those events contain —
  which is a listing id and a timestamp, never the image.
- That **no admin can see her body photo or her looks**.

**Terms of Service**

- That try-on output is **an AI approximation and not a representation of
  fit, size, colour or condition**, and must not be relied on when deciding
  to rent or buy. This matters: a renter who takes delivery and says "it
  looked different in the try-on" is a dispute we will actually get.
- That uploading a photo of **anyone other than herself** is prohibited, and
  grounds for suspension.
- That try-on results are **for her own use and must not be posted,
  published or shared** as a representation of the garment or the lender.
- That the preset models are **computer-generated and depict no real
  person**.
- That we may **limit, meter or withdraw** the feature at any time — the
  hook Phase 2's free allowance hangs from.
- **Credits (Phase 2, draft now so it ships with v2):** credits are a limited
  licence to use a digital feature, **not money and not refundable** except
  where law requires; they **expire if the account is closed**; they have no
  cash value and cannot be transferred between students; **all purchases run
  through Apple**, so refunds are requested from Apple and not from Loane —
  say that explicitly, because every refund request will otherwise come to
  us.
