# Loane roadmap

## The two questions the MVP has to answer

1. **Will girls rent from closets on their campus?**
2. **Does the social experience make them more likely to discover, engage
   with, and come back to Loane?**

Every phase below is built so we can measure both. That is why engagement
tracking exists from day one rather than being bolted on later.

---

## Must-do before beta launch

These are not a phase. They are a gate. Beta does not open until they are done.

- [ ] **Real campus email verification — a 6-DIGIT CODE, not a link.**
      Today a student types an `sc.edu` address and we believe her.
      **Do not send a link:** university security scanners follow links in
      incoming mail and would burn a one-time link before the student ever
      opened it. Email a 6-digit code she types back in, then set
      `emailConfirmed: true` and start enforcing it on listing, renting and
      messaging. The field already exists on every user and is always false
      today, so nothing has to be migrated — only a Cloud Function and one
      screen are new. *(Zack's call: not blocking any feature for now, but
      non-negotiable before beta.)*
- [ ] **Firebase App Check**, so our functions can only be called by our app.
- [ ] Terms of Service and Privacy Policy live and linked.
- [ ] Confirm the final brand hex codes (three are currently sampled from the
      deck's swatches and marked `TODO-CONFIRM`).
- [ ] Licensed Tenorite Bold and Telegraf font files in place of the free
      stand-ins.

---

## Phase 0 — Foundation ✅ *(this session)*

- [x] Monorepo with npm workspaces: `mobile`, `admin`, `backend`, `shared`
- [x] TypeScript strict mode, ESLint, Prettier at the root
- [x] `@loane/shared`: types for every collection, domain constants, brand
      tokens, validation
- [x] Documentation: architecture, data model, security, setup, roadmap,
      decisions
- [x] Firebase config, emulator suite, first-pass Firestore + Storage rules
- [x] Cloud Functions skeleton
- [x] Seed script filling the emulator with fake USC students, closets,
      listings and posts
- [x] Mobile: Expo Router, 5-tab layout with empty states, onboarding flow
      working end to end against the emulator
- [x] Admin: Vite + React shell with admin-only login
- [x] Connected to GitHub, clean commits on `main`

## Phase 1 — Accounts ✅

- [x] **One sign-up screen, school email only.** The separate personal-email
      step is gone. Only approved campus domains can create an account.
- [x] **Signup happens entirely server-side.** `createAccount` checks the
      domain, creates the login, writes the profile and claims the username
      in one call — and deletes the half-made login if any part fails, so a
      login can never exist without a profile behind it.
- [x] `emailConfirmed` on every user, always false, ready for the 6-digit
      code above
- [x] My Profile: photo, name, handle, campus, rating, bio, sizes, stats,
      and Posts / Closet / Reviews
- [x] Edit Profile: photo (camera or library, compressed before upload),
      display name, username, bio, sizing
- [x] Other students' profiles at `/u/{username}`, with Follow / Unfollow
      running as Cloud Functions
- [x] Account Settings, including a working Change Password
- [x] Events: `profile_view`, `profile_edit`, `follow`, `unfollow`
- [x] Security rules tightened to an explicit allow-list, with tests

Not done here, deliberately: the founding-closet flag is still set by hand
in the seed rather than from the admin dashboard — that is Phase 7.

## Phase 2 — Closet + Marketplace

- Add to Closet: photos, name, description, brand, size, category, condition,
  occasions, rent/sell/both, 3-day and 7-day pricing, garment value
- Image compression and resize before upload
- Edit, pause and remove a listing
- Discover: browse, search, filter by size, category, price, occasion,
  availability
- Listing detail page; the lender's closet
- Save / wishlist

### Known simplifications to revisit

- **No payment protection during beta.** No card on file means no hold, no
  refund path and nothing behind a damage claim. Survivable with founding
  closets who know each other; not survivable with strangers. This is the
  single biggest reason Phase 5 matters.
- **A flagged return has no resolution flow.** It reaches `disputed` and
  an admin can see it, but there is no way to decide it yet. Phase 5.

- **The Following feed filters instead of querying.** Firestore's `in`
  operator caps at thirty values, so querying by author breaks for anyone
  following more than thirty closets. The real fix is a fan-out feed: a
  Cloud Function writes each new post into its followers' own feed
  collections. Right at scale, far too much machinery for a campus with a
  few hundred posts.
- **Tag labels are snapshots.** A price change does not update the label
  already stored on a post. Tapping it opens the live listing, so nobody
  can act on a stale number. See docs/post-tagging.md.

- **Repeat views count.** `countListingView` increments on every view by
  anyone who is not the owner, so one person opening a listing five times
  adds five. Deduplicating needs a record per viewer per listing, which is
  an extra write on every view. Do it when the number starts driving a
  decision.
- **Discover loads up to 1,000 listings at once**, because search and
  filtering happen on the phone. The cap sits below the migration trigger
  below, so the two agree.

### Search: when to replace the current approach

Discover loads one server query — active listings on your campus, newest
first — and runs search, filters and sort **on the phone**. It feels
instant, costs nothing extra, and works on a bad signal.

**Replace it when a single campus passes roughly 1,500 active listings.**
Past that the initial load gets slow and expensive, and it still cannot do
typo tolerance — "dres" will never find "dress" this way.

**Replace it with** Typesense (~$25/mo hosted, or self-hosted) or Algolia.
A Cloud Function mirrors listings into the index on every change and the
app queries that instead. Roughly a day's work. Check the listing count per
campus on the admin dashboard before each term starts.

## Phase 3 — Social ✅

- [x] Post a Look: photos, caption, occasion tags
- [x] Instagram-style tagging, own closet only, enforced server-side —
      see [post-tagging.md](./post-tagging.md)
- [x] Paged campus feed with All Campus / Following
- [x] Like and save posts, counts via Cloud Functions
- [x] Profile Posts tab; edit caption and delete her own looks
- [x] "Seen in posts" on a listing
- [x] The engagement metrics that answer MVP question 2 now produce real
      numbers: `tagged_item_tap` is the headline one

## Phase 4 — Rentals ✅

- [x] Availability calendar showing booked and blocked days
- [x] Request a rental; the double-booking-proof Cloud Function
- [x] Accept / decline, with requests expiring after 48 hours
- [x] Full status machine, server-enforced from one transition table
- [x] Handoff: required drop-off photo, renter confirms receipt, both
      confirm return
- [x] A 48-hour window after return for the lender to flag a problem;
      flagged rentals go to `disputed` and surface in the admin panel
- [x] My Rentals with Renting / Lending
- [x] Cancellations with a reason, either side, before handoff
- [x] Lender's blocked dates
- [x] In-app alerts in Activity, with an unread badge

**No money moves.** Payments are Phase 5 and paused, so the app shows the
price breakdown and says plainly that the two of them settle up directly.
The condition photos are required anyway — with no card on file and no
hold, a before-and-after photo record is the only protection either side
has.

## Phase 5 — Payments + Protection 🚧 IN PROGRESS

**Unpaused 2026-10-05.** Built and tested against a separate "Loane Test"
Stripe account with Connect enabled in test mode, because Loane, Inc.'s own
Stripe account cannot enable Connect until its Stripe Atlas incorporation
finishes (~mid-October). Going live is then a key swap and nothing else —
see `docs/payments.md` for the runbook.

All five open decisions are settled; see `docs/decisions.md` (2026-10-05).

- [x] 1. Decisions into code: 15% renter-paid fee, $1.50 minimum, liability
      cap in place of a protection hold, cancellation windows, tests
- [x] 2. Stripe plumbing: server SDK, secrets in Secret Manager, one client
      module, `docs/payments.md`
- [ ] 3. Stripe Connect Express onboarding for lenders; `acceptBooking`
      refuses until payouts are set up
- [ ] 4. Renters save a card via hosted Stripe Checkout
- [ ] 5. Authorize at request, capture at pickup, with silent
      re-authorization before a hold lapses
- [ ] 6. Lender payout on completion
- [ ] 7. Cancellations, refunds, and claim charges against the saved card
- [ ] 8. Webhooks: signature verified, idempotent
- [ ] 9. Admin panel: payments, refunds, payouts, claim charges
- [ ] Live test in test mode: `scripts/paymentsFlowLive.ts`, self-cleaning

**Deliberately not in Phase 5:** Apple Pay and the native payment sheet.
Hosted Checkout works in Expo Go; the native SDK does not. See Phase 5c.

## Phase 5a — Production polish 📋 NEXT

**Agreed 2026-10-05. Starts when payments is finished and Zack says go.**
Make Loane feel like a real, high-quality app rather than a working one.

**Begins with a screen-by-screen review and a ranked list, before any
building.** The point is to find what actually feels unfinished, not to
guess.

- Onboarding in as few steps as possible — download to browsing in under a
  minute
- Smooth transitions between screens; consistent layout and spacing
  everywhere
- **Branded loading animation**: the Loane rings (two overlapping circles)
  gently spinning. ONE reusable component, built from the design tokens.
  Used for every full-screen wait — app launch, sign-up, payment
  processing, uploading a post or listing
- **Skeleton placeholders, not spinners**, for feeds, grids and lists, so
  they feel instant
- A helpful empty state and a clear error-with-retry on every screen
- Speed: fast feed and Discover, images cached and quick to appear
- Details: haptics on key actions, pull-to-refresh, the keyboard never
  covering an input, correct on both small and large iPhones

## Phase 5b — FAQ + AI support assistant 📋 THEN

**Agreed 2026-10-05.** In this order, FAQ first — the assistant answers out
of it, so it cannot exist first.

**FAQ**
- A real FAQ in Help & Support: renting, lending, payments and fees,
  cancellations, damage, safety, accounts
- **Editable from the admin panel**, so an answer can change without
  shipping a build

**AI support assistant (Claude API)**
- A chat in Help & Support answering from our FAQ and policies
- Can look up the user's OWN rentals and reports, read-only, for
  "where's my dress" questions
- **Clearly labelled as an AI assistant.** Never invents a policy, never
  issues a refund, never takes an action itself
- Cannot help, or the user asks for a person → opens a ticket in the admin
  Support inbox with the conversation attached
- **Cloud Function only.** API key in Secret Manager, never in the app —
  an API key shipped in a mobile binary is a public API key
- **Rate limited per user**, so it cannot be abused or run up a bill
- Admin panel: AI conversations, and the tickets it handed off

## Phase 5c — Apple Pay 📋 THEN

**Agreed 2026-10-05. Only once payments are proven working.**

- Swap hosted browser Checkout for `@stripe/stripe-react-native`'s native
  payment sheet, with Apple Pay
- **Requires a TestFlight or development build** — the native SDK does not
  run in Expo Go, and adding it stops the whole app running there
- The server side does not change. This is one screen.

## Phase 6 — Trust + Messaging ✅ (push notifications still to do)

- [x] 1:1 realtime messaging, one thread per pair
- [x] Reviews after a completed rental, both directions, editable for 48h
- [x] Star ratings on profiles, recomputed server-side
- [x] Report a user, listing, post or rental
- [x] Blocking, with the honest limits written up in
      [security.md](./security.md)
- [x] Reminders: starts tomorrow, due back today, overdue
- [x] Read alerts deleted after 30 days
- [x] Cancellations counted per user and surfaced in admin

### Push notifications — not built

Everything that *would* send a push already writes an in-app alert, so
adding push is a send step next to those writes rather than new
plumbing. What is actually needed:

1. **A development build.** Expo Go cannot receive push at all. This is
   the real blocker — `npx expo prebuild` and a build through EAS.
2. **An Apple Push key** (.p8) from the Apple Developer account, plus a
   Firebase Cloud Messaging server key for Android.
3. **Ask for permission** at a sensible moment — after her first rental
   is confirmed, not on first launch — and store the Expo push token on
   her user document. The `pushTokens` field already exists.
4. **Send from the functions that already call `notify()`.** One helper,
   called in the same place, reading her notification preferences, which
   she can already set.
5. **Respect `notificationPreferences`**, already built and saved.

Estimate: about a day once the development build exists. The build is
the long pole, not the code.

## Phase 7 — Admin dashboard build-out ✅

- Overview metrics answering both MVP questions
- User management: verify, suspend, remove
- Listing and post moderation
- Reports queue
- Damage claim review with before/after photos side by side
- Campus and email-domain management
- Founding closets tracker

## Phase 8 — Launch prep

- Firebase App Check
- Rate limiting on callable functions
- Performance pass; image loading and feed pagination
- Crash and error reporting
- Development build → TestFlight → App Store
- Onboard the 10–20 founding closets
- Seed inventory, pricing guidance, launch content

---

## Contacts import — what it would actually take

**Not built. This is the explanation Zack asked for, not a plan we have
committed to.**

The obvious version of "find who's on Loane" is: read her iPhone address
book, send it to us, tell her which of her contacts already have
accounts. Instagram and Venmo both do it. For us it does not work
cleanly, and the reason is our own signup.

**An address book is phone numbers. A Loane account is a school email.**
There is no overlap to match on. Her friend Harper is `harperhues@
email.sc.edu` to us and `(803) 555-0147` in her phone. Nothing connects
those two facts today, so a contacts import would match almost nobody.

To make it work, one of three things has to happen:

1. **Collect phone numbers at signup.** Then we can match. It adds a
   field to a flow we deliberately kept to one tap, and a phone number
   is a more sensitive thing to hold than a campus email — it is how
   people get found by someone they are avoiding.
2. **Ask for it later, optionally.** "Add your number so friends can
   find you." Honest, skippable, and it only works for the people who
   opt in, which at the start is nobody.
3. **Match on email instead.** Address books do hold emails, and some
   students will have their school address saved. The hit rate is much
   lower than phone matching, but it needs no new field from us.

**The part that matters more than any of that.** Uploading her contacts
means sending us other people's personal data — names and numbers of
people who never agreed to anything and may not use Loane at all. Doing
it properly means:

- never storing the raw numbers, only one-way hashes, and salting them
  so the stored values cannot be reversed with a rainbow table of every
  possible US phone number (which is a small, cheap table — this is a
  real attack, not a theoretical one)
- discarding every hash that does not match an existing account, rather
  than keeping a shadow profile of her friends who have not joined
- a clear prompt saying what is being sent before the OS permission
  dialog, not after
- a way to delete it that actually deletes it

That is a week of careful work and a privacy policy that says all of it
out loud. It also puts us inside the scope of things app review looks
at closely.

**Recommendation.** Not now. Username search plus the share-sheet invite
covers the same job — she sends a link to her group chat and the people
who want in, get in — without holding anybody else's contact details.
Revisit when a campus is big enough that search stops being enough, and
do option 2 if we do it at all.
