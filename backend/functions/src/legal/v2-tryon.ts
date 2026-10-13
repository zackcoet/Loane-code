/**
 * The try-on clauses, PARKED.
 *
 * AI try-on is off for v1 (Zack, 2026-10-13), so these are not in the
 * Terms or the Privacy Policy that will be published at launch. They
 * live here, finished, so that turning the feature back on is a paste
 * rather than a rewrite — and so nobody ships try-on having forgotten
 * that it needs legal text at all.
 *
 * WHAT THESE COVER, and why none of it is optional once try-on is on:
 *   - that we collect a photograph of her body
 *   - that it goes to a named third party (FASHN) outside the US
 *   - that FASHN does not train on it
 *   - that no admin can see it
 *   - that unsaved looks are deleted after 7 days
 *   - one-tap deletion
 *   - "an AI approximation, not a guide to fit, size or colour" —
 *     the sentence that matters when a renter says "it looked
 *     different in the try-on"
 *   - credits: not money, not refundable, bought through Apple
 *
 * The AI PHOTO CHECK section is in here too, because the check only
 * ever runs on a body photo or a try-on flat photo. With try-on off,
 * no photo is sent to Anthropic at all, so saying we check photos
 * would describe something that does not happen.
 *
 * TO PUT THEM BACK: paste TRYON_TERMS_SECTION into the Terms before
 * "Finding friends" and renumber, and TRYON_PRIVACY_SECTION into the
 * Privacy Policy before "Who else sees your information". Then
 * re-run scripts/seedLegalV2Draft.ts and review in admin.
 */

export const TRYON_TERMS_SECTION = String.raw`## AI features

Loane uses AI in two places. Both are described here so you know what happens to your photos.

### Photo checks

When you add a photo of yourself for try-on, or a lay-it-flat photo of a garment you're listing, **the photo is sent to a third-party AI service to check it will work** — that it shows one whole garment, or one whole person, on a plain background. The photo is sent for that check and is not stored by us to perform it. **A photo that fails the check is never saved at all.**

### AI try-on

If you choose to use try-on:

- **We collect a photograph of your body.** It is private to your account. No other student can see it, and no Loane admin can see it.
- **You confirm the photo is of you** before it's uploaded. Uploading a photo of anyone else is a breach of these Terms and grounds for suspension.
- **Your photo and the garment photo are sent to a third-party AI processor, FASHN**, located outside your campus and possibly outside the United States, for the sole purpose of generating the image. FASHN does not use them to train, fine-tune, or improve any model. We keep them until you delete them; FASHN keeps them only for the length of the request.
- **Try-on output is an AI approximation. It is not a representation of fit, size, colour, or condition**, and must not be relied on when deciding to rent or buy.
- **Try-on results are for your own use.** They must not be posted, published, or shared as a representation of a garment or a lender.
- **The preset models are computer-generated and depict no real person.**
- **Unsaved try-ons are deleted automatically after 7 days.** Saved ones are kept until you delete them.
- **You can delete everything in one tap**, in Settings. That removes your body photo, every saved look, and every generated file.
- Try-on usage is recorded as events containing a listing id and a timestamp. **The events never contain the image.**

**Try-on credits.** Every student gets a number of free try-ons. If Loane later sells additional credits: credits are a limited licence to use a digital feature. **They are not money and are not refundable** except where the law requires. They expire if your account is closed, have no cash value, and cannot be transferred between students. **All purchases are made through Apple**, so refunds are requested from Apple and not from Loane.

**We may limit, meter, or withdraw** try-on, or any other feature, at any time.
`;

export const TRYON_PRIVACY_SECTION = String.raw`## AI photo checks

When you add a body photo for try-on, or a lay-it-flat photo of something you're listing, **the photo is sent to a third-party AI service (Anthropic) to check that it will work** — one whole garment, or one whole person, plain background, enough light. We don't store the photo to run that check. **If it fails, the photo is never saved at all.**

## AI try-on

If you choose to use try-on:

**What we collect.** A photograph of your body, which you confirm is of you before it's uploaded. We record that you confirmed, and when.

**Who can see it.** You, and nobody else. **Not other students. Not Loane admins.** There is no screen anywhere in Loane, including our own admin tools, that shows a student's body photo or her try-on results.

**Who we send it to.** Your body photo and the garment photo are sent to **FASHN**, a third-party AI processor, for the sole purpose of generating the image. FASHN may be located outside the United States. **FASHN does not use them to train, fine-tune, or improve any model.** We hold them until you delete them; FASHN holds them only for the length of the request.

**How long we keep it.** Your body photo until you delete it. **Try-ons you don't save are deleted automatically after 7 days.** Saved looks are kept until you delete them.

**What we log.** That a try-on happened, which listing it was for, and when. **The events never contain the image.**

**Deleting it.** Settings → Delete my try-on photos. One tap removes your body photo, every saved look, and every generated file. We don't ask you to confirm twice.
`;
