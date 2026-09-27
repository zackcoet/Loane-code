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

## Phase 3 — Social

- Post a Look: photos, caption, occasion tags
- Tagging listings in a post, and tapping through to rent
- Home feed, Explore vs Following tabs, campus filter
- Follow, like, save
- The engagement metrics that answer MVP question 2 start producing real
  numbers here

## Phase 4 — Rentals

- Availability calendar on a listing
- Request a rental; the double-booking-proof Cloud Function
- Lender accepts or declines
- Status flow: Requested → Confirmed → With Renter → Returned
- My Rentals: upcoming and past
- Pickup and return: handoff notes, required drop-off condition photo, renter
  confirms receipt, both confirm return
- Tests for concurrent booking attempts

## Phase 5 — Payments + Protection ⏸ PAUSED

**Blocked until the company is registered.** Stripe Connect needs a legal
entity and a bank account before any of this can be built or tested, so
Phase 5 waits. Everything it will need is already designed into the data
model — every booking carries a `payment` block and a full fee breakdown —
so nothing has to be migrated when we pick it up.


- Stripe Connect onboarding for lenders
- Card on file for renters; **card not charged until a rental is confirmed**
- Rental price + Loane fee shown clearly before paying
- **Decide: who absorbs the Loane fee** — renter, lender or split
- **Decide: the protection hold percentage**
- Lender payouts
- Cancellations and refunds
- Protection hold placed and released
- Damage claims: 48-hour window, photo evidence, renter response, admin
  decision

## Phase 6 — Trust + Notifications + Messaging

- Reviews after a completed rental, both directions
- Star ratings on profiles
- Report a user, listing, post or transaction
- **Blocking users** (separate from reporting)
- 1:1 messaging
- Push notifications — needs a development build, not Expo Go
- Activity feed fully wired

## Phase 7 — Admin dashboard build-out

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
