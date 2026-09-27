# Loane architecture

How the pieces fit together, in plain English first.

## The shape of it

Loane is **one repository with four parts**:

- **`mobile/`** — the app students use. Expo (React Native), runs in Expo Go
  on your phone during development.
- **`admin/`** — a private web dashboard for you and the team. React + Vite.
- **`backend/`** — Firebase: the database, file storage, security rules, and
  Cloud Functions (small pieces of code that run on Google's servers, not on
  anyone's phone).
- **`shared/`** — the types and rules that all three agree on.

They are in one repo so that when we change what a "listing" is, we change it
in exactly one place and all three parts update together. That is the whole
reason for npm workspaces.

## The most important idea: the phone is not trusted

Anything a phone can do, a determined person can fake. So we split the world
in two:

**Things the app may write directly to the database:**
her own profile fields, her own listings, her own posts, her own messages.
If she cheats at these, she is only cheating herself.

**Things only a Cloud Function may write:**
bookings, payments, reviews, follower counts, like counts, ratings,
verification status, admin roles, reports, damage claims.

If the app could write its own follower count, follower counts would be
fiction. If the app could write a booking, two people could book the same
dress. So it can't. The security rules reject those writes no matter who is
making them, and the only code with permission is the code running on Google's
servers where nobody can edit it.

This is what "building on cement" means here.

## Why double-booking is impossible

This is the one piece of logic most worth understanding.

When a renter asks for a dress from Friday to Monday, the app does **not**
write a booking. It calls a Cloud Function named `requestBooking`. That
function opens a Firestore **transaction**, which is a way of saying "read
these documents and write this one, and if anything changed underneath me
while I was thinking, throw it all away and start over."

Inside the transaction:

1. Load the listing. Is it active? Is it rentable?
2. Load every existing booking for that listing that blocks the calendar.
3. Does any of them overlap Friday–Monday? If yes, stop.
4. Is any of those days blacked out by the owner? If yes, stop.
5. Create the booking.

Two people tapping at the exact same moment both enter step 1. Only one
reaches step 5. The other's transaction notices the world changed and retries,
now sees the conflict at step 3, and gets a clear "those dates just got
taken" message.

There is a test for this that fires many simultaneous requests at one dress
and asserts that exactly one wins.

A related detail: a **requested** booking does not block the calendar, only a
**confirmed** one does. A lender can get three requests for one gameday
weekend and pick.

## How the app talks to Firebase

Both the mobile app and the admin dashboard use the **Firebase JS SDK** with
the same web config. One config, two apps. This is why the app can run in
Expo Go — no native modules needed yet.

```
  mobile (Expo)  ─┐
                  ├─→  Firebase JS SDK  ─→  Auth / Firestore / Storage / Functions
  admin (Vite)   ─┘
                            ▲
                            │  (security rules sit here and reject bad writes)
```

For anything sensitive the app does not write to Firestore at all — it calls a
**callable function** instead:

```
  app  ──requestBooking()──>  Cloud Function  ──transaction──>  Firestore
```

## Two Firebase projects

| Project | What it is | Rule |
|---|---|---|
| `loane-dev` | Where we build and test | Deploy freely |
| `loane-code` | The real one. Something is already on its Hosting | **Never deploy without asking Zack** |

Day to day we do not even use `loane-dev` — we use the **Firebase Emulator
Suite**, which is a complete fake Firebase running on your own laptop. It
costs nothing, it starts in seconds, and you cannot break anything real with
it. A seed script fills it with fake USC students, closets, listings and posts
so the app looks alive while we build.

## Repository layout

```
loane-code/
├── mobile/              Expo app (React Native + Expo Router)
│   ├── app/             Screens. The folder structure IS the navigation.
│   │   ├── (onboarding) splash, name, signup, verify, username, intro
│   │   ├── (tabs)       feed, discover, post, activity, profile
│   │   └── (auth)       sign in
│   ├── src/
│   │   ├── firebase/    SDK setup, emulator wiring
│   │   ├── auth/        session state
│   │   ├── components/  shared UI (buttons, empty states, inputs)
│   │   ├── theme/       brand tokens turned into React Native styles
│   │   └── analytics/   the events logger
│   └── assets/
│
├── admin/               React + Vite dashboard
│   └── src/
│       ├── firebase/    SDK setup
│       ├── auth/        admin-only gate
│       └── pages/
│
├── backend/
│   ├── firebase.json        emulator + deploy config
│   ├── .firebaserc          which project is which
│   ├── firestore.rules      who may read and write what
│   ├── storage.rules        who may upload what, and how big
│   ├── firestore.indexes.json
│   └── functions/           Cloud Functions (TypeScript)
│       ├── src/
│       └── scripts/seed.ts  fills the emulator with fake data
│
├── shared/              types, constants, brand tokens, validation
└── docs/                you are here
```

## Why Expo Router

In Expo Router the folder structure *is* the navigation. A file at
`app/(tabs)/feed.tsx` is the Feed tab. There is no separate navigation config
to keep in sync, which is one fewer thing to get out of step.

The `(parentheses)` folders are groups — they organise files without adding a
segment to the URL.

## Engagement tracking

Every meaningful action writes a row to the `events` collection: app opens,
post views, listing views, likes, saves, follows, searches, filters, and
crucially `tagged_item_tap` — someone tapping a tagged garment in a post to go
rent it.

Each event records **which surface it happened on**. That is what lets us
answer whether the social feed is actually feeding the marketplace, rather
than guessing.

We log this from day one because you cannot go back and collect data from
last month.

## What is deliberately not built yet

- **Payments.** Stripe Connect is designed into the data model (every booking
  has a `payment` block and a fee breakdown) but no money moves yet. Phase 5.
- **Push notifications.** The `notifications` collection and Activity tab
  exist; actual push needs a development build, not Expo Go. Phase 6.
- **Circles.** Types exist, `posts.circleId` has a slot, nothing is built.
- **Real campus email verification.** See [roadmap.md](./roadmap.md) — this is
  a must-do before beta.

## Testing

| What | How |
|---|---|
| Security rules | `@firebase/rules-unit-testing` against the emulator — assert that a student *cannot* write her own follower count |
| Booking conflicts | Fire many simultaneous requests at one listing; assert exactly one wins |
| Shared validation | Plain unit tests; same functions run on client and server |

Security rules and booking logic get tests because those are the two places
where a bug costs real money or real trust.
