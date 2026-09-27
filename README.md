# Loane

**Style. Shared.**

Loane is a student-only social fashion marketplace — Instagram for clothes
rentals. Verified college students discover, rent, and buy clothes from other
students on their own campus. No shipping, no hassle — local handoff.

- Website: [joinloane.com](https://joinloane.com)
- Launch campus: University of South Carolina (`sc.edu`, `email.sc.edu`)

The social side and the marketplace side work together. You might open Loane
because you need a dress this weekend, or just to see what people on campus
are wearing. The goal is an app girls use even when they aren't shopping.

### The two questions the MVP has to answer

1. Will girls rent from closets on their campus?
2. Does the social experience make them more likely to discover, engage with,
   and come back to Loane?

Everything is built so we can measure both. That is why engagement tracking
exists from day one.

---

## What's in here

```
loane-code/
├── mobile/     The app students use. Expo (React Native), runs in Expo Go.
├── admin/      Private web dashboard for the team. React + Vite.
├── backend/    Firebase: database, storage, security rules, Cloud Functions.
├── shared/     Types, constants, brand tokens — the single source of truth.
└── docs/       How it works and why.
```

One repository with npm workspaces, so a "listing" means the same thing in
all three apps. Change the definition once and everything updates together.

## Getting it running

Full instructions, including what to install: **[docs/setup.md](docs/setup.md)**

The short version — three terminals:

```bash
npm install
```

```bash
npm run emulators
```

```bash
npm run seed
```

```bash
npm run mobile
```

Then scan the QR code with your iPhone camera to open it in Expo Go.

Seeded accounts all use the password `loane1234`:
`ellapetrickcloset@email.sc.edu` (student), `admin@joinloane.com` (admin).

> **Your phone can't see "localhost."** When running on a real device, set
> `EXPO_PUBLIC_EMULATOR_HOST` in `mobile/.env` to your laptop's wi-fi IP
> (`ipconfig getifaddr en0`). See [docs/setup.md](docs/setup.md).

## The docs

| | |
|---|---|
| [architecture.md](docs/architecture.md) | How the pieces fit together, and why double-booking is impossible |
| [data-model.md](docs/data-model.md) | Every collection, who can write it, and why it's shaped that way |
| [security.md](docs/security.md) | What the app is and isn't allowed to do |
| [setup.md](docs/setup.md) | Install, run, test, deploy, troubleshoot |
| [roadmap.md](docs/roadmap.md) | What's built, what's next, what must happen before beta |
| [design-system.md](docs/design-system.md) | Tokens, components, and the no-raw-values rule |
| [post-tagging.md](docs/post-tagging.md) | How tagging pieces in a post works (designed now, built in Phase 3) |
| [decisions.md](docs/decisions.md) | Why things are the way they are |
| [parallel-agents.md](docs/parallel-agents.md) | Running two AI tools at once without them colliding |

## Tech stack

| Part | Built with |
|---|---|
| Mobile | Expo (React Native) + Expo Router + TypeScript |
| Admin | React + Vite + TypeScript |
| Backend | Firebase: Auth, Firestore, Storage, Cloud Functions |
| Shared | TypeScript, consumed directly as source |
| Payments | Stripe Connect *(designed, built in Phase 5)* |
| Tests | Vitest + `@firebase/rules-unit-testing` |

## The one idea worth understanding

**The phone is not trusted.**

A user's app can write her own profile, her own listings, her own posts and
her own messages. It cannot write bookings, reviews, follower counts,
ratings, verification status or admin roles. Those are written only by Cloud
Functions running on Google's servers, where nobody can edit the code.

If the app could write its own follower count, follower counts would be
fiction. If the app could write a booking, two people could book the same
dress. So it can't.

Read [docs/security.md](docs/security.md) before changing anything in
`backend/`.

## Tests

With the emulators running:

```bash
npm test
```

30 tests covering the two things that would hurt most if they broke:

- **Security rules** (24) — a student cannot mark herself verified, inflate
  her follower count, edit someone else's listing, or touch bookings.
- **Double-booking** (6) — ten simultaneous requests for the same dress on
  the same weekend produce exactly one booking.

## Deploying

**Nothing here deploys automatically, and nothing deploys to Hosting.**

| Alias | Project | Rule |
|---|---|---|
| `demo` | `demo-loane` | Local emulators. Not a real project. The default. |
| `dev` | `loane-dev` | Development. Safe to deploy to. |
| `prod` | `loane-code` | **Live. Already has something on Hosting.** Ask Zack first. |

```bash
cd backend && firebase deploy --only firestore:rules,storage:rules,functions --project dev
```

## Status

**Phase 0 complete.** Foundation, docs, security rules, Cloud Functions,
seed data, the onboarding flow, the tab shell, and the admin login all work.

Next: **Phase 1 — Accounts.** See [docs/roadmap.md](docs/roadmap.md).

### Before beta launch, non-negotiable

- [ ] **Real campus email verification.** Right now, typing an `sc.edu`
      address is all it takes. We must email a confirmation link before real
      students and real garments are involved.
- [ ] Firebase App Check
- [ ] Terms of Service and Privacy Policy
- [ ] Final brand hex codes (three are sampled, marked `TODO-CONFIRM`)
- [ ] Licensed Tenorite Bold and Telegraf font files
