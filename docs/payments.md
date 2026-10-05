# Payments

How money moves through Loane, and how to operate it.

Read `docs/decisions.md` (2026-10-05) for *why* any of this is the way it
is. This document is the *what* and the *how*.

---

## The shape of it

| | |
|---|---|
| Loane's fee | **15%** of the rental, **paid by the renter** on top, minimum **$1.50** |
| Lender receives | exactly the price she listed |
| Card authorized | when the renter **requests** |
| Card captured | when the renter **confirms she has the piece** |
| Lender paid | when the rental **completes** |
| Protection | a **liability cap**, charged only on an approved claim. **Nothing is ever held.** |
| Card entry | **hosted Stripe Checkout** in a browser (works in Expo Go) |

Every booking freezes its own `amounts` and carries its own `payment`
block, so changing any of the above never rewrites a booking already made.

---

## Which Stripe account

Phase 5 is built and tested against a **separate "Loane Test" Stripe
account** with Connect enabled in test mode.

Loane, Inc.'s own Stripe account (`acct_1UNGsWInGv2snUEp`) cannot enable
Connect until its Stripe Atlas incorporation finishes, and waiting would
block all of Phase 5 on paperwork. Verified 2026-10-05: that account has
`charges_enabled: false`, `details_submitted: false` and both
`card_payments` and `transfers` `inactive`.

**Test mode does not need account activation.** Verified directly against
the un-activated account: a $40.25 manual-capture authorization was created,
confirmed with `pm_card_visa`, reached `requires_capture`, and was
cancelled. Activation matters only for live mode. Connect is the one thing
that genuinely is gated, which is why the separate test account exists.

---

## Secrets

Two, both in Google Secret Manager via Firebase. **Never in a `.env` file,
never in the repo, never pasted into a chat.**

| Secret | What it is |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` now, `sk_live_…` at launch |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…`, from the webhook endpoint in the Stripe dashboard |

Set one (it prompts, so the value is typed and never lands in shell
history):

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY --project loane-code
```

Then redeploy, because a function reads a secret's value at deploy time:

```bash
cd backend && firebase deploy --only functions --project loane-code
```

Other useful commands:

```bash
firebase functions:secrets:access STRIPE_SECRET_KEY --project loane-code
firebase functions:secrets:destroy STRIPE_SECRET_KEY --project loane-code
```

The **publishable key** (`pk_test_…` / `pk_live_…`) is *not* a secret — it
identifies the account and can do nothing on its own. It lives in app
config (`mobile/eas.json`, `.env.example`) and may be committed.

### Rotate the first key before launch

The original Loane, Inc. test key was pasted into a chat transcript on
2026-10-05. It is test mode so it can move no real money, but **rotate it in
the Stripe dashboard before going live** regardless. When the live key is
issued, set it with the command above and type it at the prompt — it should
never be pasted anywhere else.

---

## Going live is a key swap and nothing else

By design. **No Stripe account id, webhook id or price id appears anywhere
in the code.** The secret key and webhook secret come from Secret Manager;
the publishable key from app config.

### The one thing that does not survive a swap

**Per-user Stripe ids.** A Connect account and a customer belong to the
platform that created them, so every `user.stripe.accountId` and
`customerId` created under "Loane Test" becomes meaningless under Loane,
Inc.

This is why `user.stripe.platformAccountId` exists: it records which
platform each id came from. A mismatch is then **detectable**, and the user
can be asked to reconnect, rather than hitting an error nobody can explain.

### Runbook

1. Loane, Inc.'s Stripe account is activated and Connect is enabled.
2. Rotate and set the live keys:
   `firebase functions:secrets:set STRIPE_SECRET_KEY --project loane-code`
   and the same for `STRIPE_WEBHOOK_SECRET`.
3. Create a **live-mode** webhook endpoint in the Stripe dashboard pointing
   at the deployed `stripeWebhook` function. Its signing secret is the one
   from step 2.
4. Update the publishable key in `mobile/eas.json` and ship a build.
5. Deploy functions.
6. **Clear stale per-user Stripe ids.** Any user whose
   `stripe.platformAccountId` is not the new platform must have
   `accountId`, `customerId` and `defaultPaymentMethodId` cleared and
   `payoutsEnabled` set false, so they re-onboard cleanly. Lenders set up
   payouts again; renters re-save a card.
7. Run the live flow in **live mode with real money, once, for a dollar**,
   and refund it. Test mode proves the code; only live mode proves the
   account.

---

## Things the API forces on us

### `payment_method_types` no longer exists

Removed in API version `2026-09-30`. Passing it is a hard `400`. Payment
methods are configured in the Stripe Dashboard and selected dynamically.
Use `PAYMENT_METHOD_CONFIG` from `src/lib/stripe.ts`.

### Redirect-based methods are refused deliberately

`PAYMENT_METHOD_CONFIG` sets `allow_redirects: 'never'`. A method that
bounces the renter to her bank's own page leaves nothing behind that can be
charged while she is absent — and Loane's protection model depends on
charging an approved claim off-session, days later. In practice this means
card and Link.

### The API version is pinned

`2026-09-30.endive`, in `src/lib/stripe.ts`. Stripe ships breaking changes
behind dated versions. Bump the pin and the SDK together, and read the
changelog when you do — the `payment_method_types` removal above is exactly
what an unpinned client would have discovered through a charge behaving
differently.

### Authorizations expire after about 7 days

Which is a problem, because Loane authorizes at request and captures at
pickup, and a formal booked three weeks out would see its hold lapse in
between — silently.

Because the renter's card is saved with an off-session mandate, a hold about
to lapse is **replaced without involving her**. The booking sweep does this
inside `REAUTHORIZE_BEFORE_EXPIRY_HOURS` and counts it in
`payment.reauthorizedCount`. Only if a silent replacement fails is she asked
to re-confirm, and the handoff is blocked until she does.

### Idempotency is not optional

Cloud Functions retry. Stripe webhooks retry. A client on campus wifi
retries. "Capture the payment" running twice is two charges on a real card.

Use `idempotencyKey(action, bookingId)` from `src/lib/stripe.ts`. The key is
derived from *what is being done* and never from the clock or a random
value — a fresh key on every retry is the same as no protection at all.
Verified against the live API: the same key returns the same PaymentIntent.

---

## Testing

Stripe's test cards, used against the test account:

| Card | Behaviour |
|---|---|
| `4242 4242 4242 4242` | succeeds |
| `4000 0000 0000 9995` | declines, insufficient funds |
| `4000 0000 0000 0341` | attaches fine, then **fails when charged off-session** — the claim path |
| `4000 0025 0000 3155` | requires authentication (3DS) |

Any future expiry, any CVC, any ZIP.

Connect onboarding in test mode accepts Stripe's own fake details: SSN
`000-00-0000`, routing `110000000`, account `000123456789`. **Never use
anyone's real SSN or bank account, including your own.**

The end-to-end script, which cleans up after itself:

```bash
cd backend/functions && npx tsx scripts/paymentsFlowLive.ts --project loane-code
```

It refuses to run against a live Stripe key — see `assertTestMode`. The
danger is not today; it is the day someone runs a test script after the keys
have been swapped.

---

## What is deliberately not here

**Apple Pay and the native payment sheet.**
`@stripe/stripe-react-native` is a native module, so adding it stops the
whole app running in Expo Go — including everything unrelated to payments.
Hosted Checkout works in Expo Go today and the server side is identical
either way, so the swap is one screen. Phase 5c, after payments are proven.
