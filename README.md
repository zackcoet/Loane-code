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

> **Testing on a real phone?** Run `npm run lan` first — it points the app
> at your laptop's current Wi-Fi address. Run it again whenever you change
> networks. See [docs/setup.md](docs/setup.md) if it still will not connect.

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

356 tests, covering the things that would hurt most if they broke:

- **Security rules** (158) — a student cannot mark herself verified or
  confirm her own email, inflate her follower count, edit someone else's
  listing, or touch bookings.
- **Double-booking** — many simultaneous requests for the same dress on the
  same weekend produce exactly one booking.
- **Email verification** (11) — the real functions, called through `.run()`,
  for the right code, the wrong code, an expired code, the attempt limit and
  the hourly send limit.

## Email verification

A student proves she controls the school inbox she signed up with by typing
back a **6-digit code**. Not a link: university mail systems run scanners
that follow every link in an incoming message, which burns a one-time link
before she has opened it.

**How it runs.** She finishes sign-up, lands on "Enter your code", and the
app calls `sendVerificationCode`. The server makes the code, stores only a
hash of it, and emails it. `confirmVerificationCode` checks what she typed
and sets `emailConfirmed` on her account. The app never sees a correct code,
so there is nothing for it to skip.

- Codes last **10 minutes**. A new code replaces the old one.
- **5 wrong attempts** per code, then she needs a new one.
- **5 codes per account per hour.**
- Stored as a SHA-256 hash salted with her uid — never in plain text, never
  in a log line.

**Two flags, and they are not the same thing.** `isVerified` means her
address is on a school domain, which is true the moment she types it.
`emailConfirmed` means the mailbox answered. Only the second is evidence,
and it is the one the security rules check.

**The switch.** `config/verification.required` in Firestore decides whether
an unconfirmed student is blocked. It is off by default and lives in the
database rather than in the app, so it can be turned off in seconds if email
breaks — without shipping a build to the App Store.

### Changing who sends the email

All sending lives in **one file**: `backend/functions/src/lib/email.ts`.
Nothing else in the codebase knows or cares which provider is used — callers
pass an address, a code and a first name.

Today it is **Gmail**, with an App Password, from `loaneapp@gmail.com`. That
was chosen for speed: no domain records, no sales call, no sandbox approval.
It has two real limits. A free Gmail sends about **500 messages a day**, and
a code from a personal `gmail.com` address is likelier to land in Spam or
Promotions than one from `joinloane.com` — and a university filter is the
fussiest audience there is.

To move to a domain sender (Resend, Postmark, SES):

1. Replace `transport` and `FROM` in that file. Nothing else changes.
2. Set the new secret:
   `firebase functions:secrets:set NEW_PROVIDER_KEY --project loane-code`
3. Swap the name in the `secrets: [...]` list on the two functions in
   `backend/functions/src/auth/emailVerification.ts`.
4. Delete the old secret:
   `firebase functions:secrets:destroy GMAIL_APP_PASSWORD --project loane-code`

**The App Password is a secret in the strongest sense.** It lets whoever
holds it send as that account and read its inbox over IMAP, and it bypasses
2-Step Verification. It lives in Google Secret Manager and nowhere else. If
one is ever pasted somewhere it shouldn't be, revoke it at
myaccount.google.com/apppasswords and set a new one — the old one dies the
moment it is deleted.

**Locally there is no secret at all.** Against the emulator the sender logs
the code to the emulator console instead of sending, so the whole flow is
testable without touching Gmail. That path is impossible in production: a
deployed function declares the secret and will not start without it.

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

- [x] **Real campus email verification.** Built: a 6-digit code to her
      school inbox. See "Email verification" above. Still needs the switch
      turning on (`config/verification.required`) once a test code has
      actually landed in a real inbox.
- [ ] Firebase App Check
- [ ] Terms of Service and Privacy Policy
- [ ] Final brand hex codes (three are sampled, marked `TODO-CONFIRM`)
- [ ] Licensed Tenorite Bold and Telegraf font files
