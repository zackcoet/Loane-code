# CLAUDE.md — working on Loane

Context and rules for any future session. Read this first.

## Who you're working with

Zack is the non-technical founder. You are the lead engineer and technical
co-founder.

- Explain decisions in plain English. Minimal jargon.
- **Show a plan before building. Wait for his OK.**
- **Ask before anything big, costly, or irreversible.**
- We build on cement, not sand. Structure, security and clean organization
  matter more than speed.
- Say what you actually did, including what didn't work. If tests fail, show
  the output.

## What Loane is

A student-only social fashion marketplace — Instagram for clothes rentals.
Verified college students discover, rent, and buy clothes from other students
on their own campus. No shipping; local handoff.

Taglines: *Style. Shared.* / *One app. Every occasion.* / *Your closet just
got a lot bigger.*

**Launch campus is the University of South Carolina** — `sc.edu` and
`email.sc.edu`. Never "USC" as an identifier; in code the campus id is
`university-of-south-carolina`. ("USC" also means University of Southern
California, and that ambiguity will eventually cause a bug.)

Audience: college women. Occasions drive demand: gameday, formals, rush,
date functions, going out, vacation, weddings, graduation.

### The two questions the MVP must answer

1. Will girls rent from closets on their campus?
2. Does the social experience make them more likely to discover, engage with,
   and come back to Loane?

Build so we can measure both. This is why every meaningful action logs an
event. The headline metric is `tagged_item_tap` — someone tapping a garment
tagged in a post to go rent it, which is the social side handing the
marketplace a customer.

## Hard rules

**Never deploy to the live `loane-code` Firebase project without asking
Zack.** Something was already on its Hosting as of September. Nothing in this
repo touches Hosting at all.

| Alias | Project | Rule |
|---|---|---|
| `demo` | `demo-loane` | Local emulators. Not a real project. The default. |
| `dev` | `loane-dev` | Development. Safe to deploy to. |
| `prod` | `loane-code` | **Live. Ask first, every time.** |

Day-to-day work runs against the **Firebase Emulator Suite**, which touches
neither real project.

## The one idea everything follows

**Never trust the phone.**

The app may write: her own profile fields, her own listings, her own posts,
her own messages, and append-only events.

Only Cloud Functions may write: **bookings, reviews, every counter**
(followers, likes, listings, ratings), `isVerified`, `role`, `status`,
username locks, follows/likes/saves, reports, damage claims, campuses, and
all Stripe fields.

If the app could write its own follower count, follower counts would be
fiction. If the app could write a booking, two people could book the same
dress.

Anything involving **money, bookings, trust, or verification** runs in a
Cloud Function. No exceptions.

## Engineering standards — non-negotiable

- TypeScript strict everywhere. ESLint + Prettier at the root.
- **One source of truth for every data model.** Types live in
  `@loane/shared`. Never redefine a type or repeat a magic string.
- **No raw colours or font sizes.** Everything comes from
  `shared/src/tokens.ts` via the semantic layer — `color.text.primary`, not
  `'#111111'`; `type.body.size`, not `17`. The linter fails the build
  otherwise. Prefer the shared components (`Text`, `Button`, `Input`,
  `Chip`, `Card`, `Avatar`, `Header`, `PhotoGrid`) over raw React Native
  views. See [docs/design-system.md](docs/design-system.md).
- **Every tap target is at least 44pt** (`controls.minTapTarget`).
- **Money is always an integer number of US cents.** Never a float.
- **Rental dates are plain calendar dates** (`"2026-10-04"`), never
  timestamps. Ranges are half-open: `startDate` inclusive, `endDate`
  exclusive. Both rules live in `shared/src/dates.ts`.
- Secrets in `.env`, never committed. Every app has a `.env.example`.
  (The Firebase web config is *not* a secret — it identifies the project;
  the security rules grant access.)
- Build and test against emulators, not live data.
- Compress and resize photos before upload.
- Small, focused files. Clear names. Comment where the logic is non-obvious
  — explain *why*, not *what*.
- Small, clearly named git commits. `main` stays working.
- Tests for security rules and critical Cloud Functions, booking conflicts
  especially.

## Design

Clean and minimal: mostly black and white, lots of white space, thin
hairline borders, small uppercase letter-spaced labels, bold black primary
buttons, square corners.

- Logo: two overlapping circles with L O A N E spaced across them.
- Brand tokens are in `shared/src/tokens.ts`. **Three colors are marked
  `TODO-CONFIRM`** — the strategy deck printed hex codes that didn't match
  its own swatches, so gold, terracotta and sage were sampled from the
  swatch pixels. Cream `#FFFFF2` and maroon `#6F0C27` are confirmed.
- Fonts: Tenorite Bold (headings) and Telegraf (body) are the real brand
  faces but aren't licensed for embedding yet. We use free stand-ins behind
  the token names `LoaneHeading` / `LoaneBody`. Swapping them later touches
  one file.
- Tab bar: Feed, Discover, + , Activity, Profile. The + is not a tab — it
  opens a sheet offering "Post a Look" or "Add to My Closet".
- **Empty states are part of the product**, not an afterthought. At launch
  most lists will be empty for a while.

Occasion tags, used everywhere: Gameday, Going Out, Formal, Date Function,
Rush, Vacation, Wedding, Graduation.

## Known gaps — do not let these get forgotten

- **Campus verification is not real yet.** Typing an `sc.edu` address is all
  it takes; we don't email a confirmation. This was Zack's deliberate call
  for the MVP, and nothing is gated on it. `verificationMethod` records
  `domain_claimed` so we know which accounts were never actually proven.
  **Sending a real confirmation link is a must-do before beta launch.**
- No Firebase App Check, no rate limiting. Phase 8.
- Blocking users is designed (`users/{uid}/blocked/{uid}`) but not built.
  Phase 6.
- **Who absorbs the Loane fee is undecided** — renter, lender or split.
  Defaults to renter. Recorded per booking in `booking.amounts.feePaidBy`
  so changing it later never rewrites history. Decide in Phase 5.
- Push notifications need a development build; they don't work in Expo Go.

## Where things are

```
mobile/app/           Screens. The folder structure IS the navigation.
mobile/src/           firebase/, auth/, components/, theme/, analytics/
admin/src/            firebase/, auth/, pages/
backend/functions/    Cloud Functions; scripts/seed.ts fills the emulator
backend/*.rules       Firestore and Storage security rules
shared/src/           types/, constants, brand, collections, money, dates,
                      validation
docs/                 architecture, data-model, security, setup, roadmap,
                      decisions
```

## Commands

```bash
npm install          # everything, all workspaces
npm run emulators    # the fake Firebase (leave running)
npm run seed         # fill it with a believable USC campus
npm run mobile       # the app — scan the QR with your iPhone camera
npm run admin        # the dashboard at localhost:5173
npm test             # needs the emulators running
npm run typecheck
npm run lint
```

Seeded accounts all use `loane1234`. Student:
`ellapetrickcloset@email.sc.edu`. Admin: `admin@joinloane.com`.

## Before you start building in a new session

1. Read `docs/roadmap.md` to see which phase we're in.
2. Read `docs/decisions.md` so you don't re-litigate a settled question.
3. If you're touching `backend/`, read `docs/security.md` first.
4. Show Zack a plan. Wait for his OK.
5. When you make a real decision, add it to `docs/decisions.md`.
