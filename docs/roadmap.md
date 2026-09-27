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

- [ ] **Real campus email verification.** Today a student types an `sc.edu`
      address and we believe her. Before real students and real garments are
      involved, we must email a confirmation code or link and only then set
      `isVerified`. Everything is already wired for this — only the Cloud
      Function changes. *(Zack's call: skip for now, do not block features
      on it, but this is non-negotiable before launch.)*
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

## Phase 1 — Accounts

- Profile editing: photo upload, display name, bio, sizing
- Viewing another student's profile and closet
- Account settings screen (from the mockups)
- Username changes, with the lock document handled correctly
- Founding-closet flag, set by an admin
- *Deferred from the gate above:* real email verification lands here if we
  choose to do it early

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

## Phase 5 — Payments + Protection

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
