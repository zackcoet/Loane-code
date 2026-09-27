# Decision log

Why things are the way they are. Newest first. When we change our minds, we
add a new entry rather than editing an old one — the reasoning matters as
much as the answer.

---

## 2026-09-27 — An admin action and its audit row are one write

**Decision:** Every admin Cloud Function queues the change and the
`adminActions` row onto the same batch. `adminActions` is append-only
even for admins.

**Why:** If the audit row is a second write, it can fail on its own, and
then an action exists that nobody can account for. That is precisely the
situation an audit log is for. Making it one commit means the log cannot
be behind the truth.

---

## 2026-09-27 — A resolved dispute ends as `completed`, not a new status

**Decision:** Deciding a flagged return records an outcome and a note on
the booking and moves it to `completed`, bumping the rental counters the
sweep would normally have.

**Why:** The rental did happen. A separate `resolved` status would add a
branch to the state machine for no behavioural difference. When Phase 5
lands, the outcome is what triggers a claim against the hold.

---

## 2026-09-27 — Blocking is enforced on actions, filtered on content

**Decision:** Messaging, renting and following are refused server-side
between blocked users. Hiding their content from each other's feed
happens on the phone.

**Why:** Firestore cannot query "everything except these fourteen
people". Doing it properly means a per-user fan-out feed, which is a
large piece of machinery to build for a campus with a few hundred posts.

**Accepted:** someone technical who blocked you could still see your
public posts. The things that actually hurt cannot happen.

**Also accepted:** `blockedBy` is readable by the person blocked, which
technically tells her she was blocked — her app needs it to filter. The
interface never says so; a blocked profile reads "not available", the
same as a deleted one.

**Revisit when:** we build a fan-out feed, which also fixes the
Following-tab limit. Do both at once.

---

## 2026-09-27 — One conversation per pair of students, forever

**Decision:** A conversation's id is the two uids sorted. Messaging from
a listing, from a profile, and the chat a confirmed rental gets are all
the same thread.

**Why:** Two people should never wonder which of their chats the other
one meant. It also makes "do we already have a thread?" a point read
rather than a query.

---

## 2026-09-27 — Messages are written by the app, not a function

**Decision:** The app writes messages straight to Firestore. A trigger
updates the thread preview and unread badge afterwards.

**Why:** Sending a message is the one interaction that has to feel
instant. A callable would add a round trip to every message. Everything
sensitive about a message — who sent it, that it cannot be edited — is
enforced by the rules instead.

---

## 2026-09-27 — Design tokens are two layers, and raw values are a lint error

**Decision:** `palette` holds raw values (what a colour is). `color`, `type`
and the size scales name things by purpose (what it is for). Screens only
touch the second layer. A lint rule fails the build on any hex string or
numeric `fontSize` outside `shared/src/tokens.ts`.

**Why:** Sizing had been set screen by screen and had already drifted — the
first UI pass found eighteen hand-written font sizes. A convention nobody
enforces is not a convention. The rule caught those eighteen the moment it
was switched on.

**Exemption:** `admin/` is exempt for now because Codex is rebuilding it in
a separate worktree. `shared/src/brand.ts` keeps the old flat names alive
as aliases so admin keeps compiling. Both are deleted when that branch
merges.

---

## 2026-09-27 — Phase 5 is paused until the company is registered

**Decision:** No payments work until there is a legal entity.

**Why:** Stripe Connect needs a registered business and a bank account.
Building against it before that exists means building against something we
cannot test or ship.

**Cost of waiting:** none. The data model already carries the payment and
fee fields, so nothing migrates later.

---

## 2026-09-27 — Sign-up runs entirely on the server

**Decision:** The app no longer creates Firebase Auth accounts. One callable
function, `createAccount`, checks the school domain, creates the login,
writes the profile and claims the username — and deletes the login it just
made if any later step fails. The app then signs in with a one-time token
the function returns.

**Why:** The obvious flow is "app creates the login, then calls us to make
the profile." That leaves a gap where a login exists with no Loane profile,
and anyone willing to skip the second call could sit there indefinitely.
Zack asked whether the server could do the whole thing instead of paying for
Identity Platform. It can, and it closes the gap at no cost.

**Trade-off:** `createCustomToken` needs the functions service account to
hold the "Service Account Token Creator" role in production. A one-time,
free grant in the Google Cloud console. Emulators do not need it.

**Knock-on:** the password now has to survive from the email screen to the
username screen. It is held in memory only and never written to disk, so an
app reload sends her back one screen to retype it.

---

## 2026-09-27 — Campus verification is a 6-digit code, never a link

**Decision:** When we ship real verification it will email a 6-digit code
she types back into the app. Not a magic link.

**Why:** University mail systems run security scanners that follow every
link in incoming mail. A one-time link would be consumed by the scanner
before the student ever saw the email, and she would be locked out through
no fault of her own.

---

## 2026-09-27 — `isVerified` and `emailConfirmed` are two different things

**Decision:** Keep both fields, with sharply different meanings.
`isVerified` means her domain is on the approved list, so she may use the
app — true from signup. `emailConfirmed` means we have proven she controls
that inbox — always false today.

**Why:** Zack asked for `emailConfirmed`. We already had `isVerified`, and
two fields that sound alike are a bug waiting to happen, so the split is
written down here and in the type. When the code ships, `emailConfirmed`
flips and we start enforcing it. No documents migrate.

---

## 2026-09-25 — Skip real campus email verification for MVP

**Decision:** Build the "Verify your campus" screen exactly as designed.
Accept any email that matches an approved campus domain and mark the account
verified. Do not send a confirmation email yet. Do not gate any feature on
`isVerified`.

**Why:** Zack's call — speed to a working product. The screen and the field
both exist, so turning on real verification later is a change to one Cloud
Function and nothing else.

**Risk accepted:** Typing `anyone@sc.edu` proves nothing. Until real
verification ships, "student-only" is an intention, not a guarantee.

**Mitigation:** `verificationMethod` records `domain_claimed` for every
account verified this way, so when real verification ships we know exactly
which accounts were never actually proven. Listed as a must-do gate before
beta launch in [roadmap.md](./roadmap.md).

---

## 2026-09-25 — Brand colors taken from the deck's swatches, not its printed hex codes

**Decision:** Use `#FFFFF2` cream, `#6F0C27` maroon, `#D6B04D` gold,
`#B5784C` terracotta, `#B8C7C2` sage.

**Why:** The brand deck printed hex codes underneath its swatches that did not
match the swatches for three of five colors — the gold swatch was labelled
`#b8406e` (a pink), the terracotta `#180c04` (a near-black brown), the sage
`#d57296` (a pink). Cream and maroon matched. The three mismatched values were
sampled from the swatch pixels.

**Status:** Gold, terracotta and sage are marked `TODO-CONFIRM` in
`shared/src/brand.ts`. Replace them if the designer supplies exact values.

---

## 2026-09-25 — A separate `loane-dev` Firebase project

**Decision:** Create `loane-dev` for development. Never deploy to the live
`loane-code` project without asking Zack first.

**Why:** Something was already deployed to `loane-code` Hosting in September.
A mistaken deploy would overwrite it. A separate project costs nothing on the
Blaze plan until it is used, and it removes an entire category of accident.

**In practice:** day-to-day work runs against the local Emulator Suite, which
touches neither project.

---

## 2026-09-25 — Money is always integer cents

**Decision:** Every amount is an integer count of US cents. Never a float,
never a string.

**Why:** `0.1 + 0.2` is not `0.3` in floating point. Storing a rental price
as `45.00` guarantees a rounding bug eventually charges someone the wrong
amount. `4500` cannot drift.

---

## 2026-09-25 — Rental dates are calendar dates, and ranges are half-open

**Decision:** Rental dates are plain `"YYYY-MM-DD"` strings, not timestamps. A
booking covers `startDate` up to but **not including** `endDate`.

**Why:** Timestamps drag in time zones, and a rental has nothing to do with
time zones — a dress is booked for Friday, not for Friday 00:00 UTC. Half-open
ranges mean a booking that ends the 10th and one that starts the 10th do not
collide, which is the real-world behaviour: she returns it in the morning, the
next girl takes it that afternoon. Both rules live in `shared/src/dates.ts` so
there is one place to get them right.

---

## 2026-09-25 — Bookings are only ever written by Cloud Functions

**Decision:** The app cannot write to the `bookings` collection at all. It
calls a callable function, which does the work inside a Firestore transaction.

**Why:** Double-booking is the failure that would most damage trust — a girl
showing up for a gameday dress that someone else already has. A transaction is
the only way to make it genuinely impossible rather than merely unlikely.

**Same reasoning applies to:** reviews, all counters, verification status,
roles, reports and claims.

---

## 2026-09-25 — Compound document ids for likes, saves and follows

**Decision:** A like's document id is `{uid}_{postId}` rather than a random id.

**Why:** Double-liking becomes impossible by construction instead of something
we have to check for. Writing the same id twice is one document, not two. It
also makes "has she liked this?" a single cheap read instead of a query.

---

## 2026-09-25 — The campus id is `university-of-south-carolina`, never `usc`

**Decision:** Spell it out. Approved domains: `sc.edu`, `email.sc.edu`.

**Why:** "USC" means University of South Carolina here and University of
Southern California to most of the internet. An ambiguous identifier in a
database is a bug waiting for the second campus to arrive.

---

## 2026-09-25 — Free font stand-ins for now

**Decision:** Ship Archivo Bold in place of Tenorite Bold and Inter in place
of Telegraf, behind the token names `LoaneHeading` and `LoaneBody`.

**Why:** Tenorite is a Microsoft font not licensed for app embedding; Telegraf
is a paid license. Using token names rather than font names means swapping in
the licensed files later touches one file.

---

## 2026-09-25 — Who pays the Loane fee is left open

**Decision:** Not decided. Default to the renter paying it on top of the
rental price. Record `feePaidBy` on every booking.

**Why:** It is a business decision, not an engineering one, and it does not
need to be made yet. Recording the split per booking means changing the answer
later never rewrites past bookings.

**Decide by:** Phase 5.

---

## 2026-09-25 — One repo with npm workspaces

**Decision:** `mobile`, `admin`, `backend/functions` and `shared` in a single
repository.

**Why:** A listing means the same thing in all three. Separate repos would
mean three copies of that definition drifting apart. One repo, one definition,
imported everywhere.
