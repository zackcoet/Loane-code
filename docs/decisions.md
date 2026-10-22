# Decision log

Why things are the way they are. Newest first. When we change our minds, we
add a new entry rather than editing an old one — the reasoning matters as
much as the answer.

---

## 2026-10-22 — For You never reshuffles under her thumb, and ranks page by page (autopilot run 16)

**Decision:** All Campus is ranked on her phone from the pages already
loaded. A look keeps its place once placed; new uploads go on top as a
group, each older page is ranked on its own and added at the bottom, and
only pull-to-refresh works the whole order out again. Variety (max 2 in a
row from one girl) and discovery (1 in 4 from someone she doesn't follow)
are applied after scoring, by moving looks, never dropping them.

**Why not re-rank everything on every change:** the first page is a live
listener, so every like on campus would change scores and move cards
while she is reading — the worst feeling a feed can have. **Why page by
page instead of across the campus:** ranking across everything means
reading everything first, which is a server job and real cost; at a few
hundred looks the newest page holds the looks worth seeing anyway.
**Why a look waits for its pieces:** placing it first and scoring
availability later would move it once the read lands.

---

## 2026-10-22 — One impression per look per session, counted when it leaves (autopilot run 14)

**Decision:** The feed writes one `post_impression` event per look per
app session, when the look leaves the screen, carrying how long it was
at least half visible (`dwellMs`, 300ms floor, 60s cap) and its position.

**Why not one event on appear plus one on leave:** twice the writes for
the same information, and a pair that loses its second half when the app
is closed. **Why not every scroll past:** a girl scrolling up and down
ten looks would write hundreds of rows saying nothing new. Revisits are
lost, which the ranking can live without; likes, saves and taps already
say "came back to it".

**Why profile opens carry `from`:** the ranking's "who" signal needs to
tell "tapped her name on a look" from "searched for her". Only known
values are written, so a hand-typed link cannot put free text in an event.

---

## 2026-10-22 — An index checker reads the code; paged lists grow or append

**Decision:** `npm run check:indexes` (backend/functions/scripts/
indexCheck.ts) reads every Firestore query in the app, admin and
functions and fails if `firestore.indexes.json` lacks the composite
index production needs. It also runs inside `npm test` and in CI. A
query it cannot read (a field name passed in as a parameter) must carry
an `index-check:` comment saying why it needs none; otherwise the check
fails. It deliberately treats a reversed index as missing — a false
alarm a person double-checks is cheaper than a crash.

**Why read the code instead of running queries:** the emulator never
enforces indexes, which is how the booking sweep crashed for weeks.
Reading the code needs no project and no network, so it can run
anywhere, including the overnight runner.

**Two paging shapes, chosen by which end changes:**
- *Chats* (newest at the bottom, new messages arrive at the newest
  end): the newest page is live; older pages are fetched once as she
  scrolls up. Once she scrolls, the live listener is pinned down to
  where the first page ended (`endAt`), so a new message never pushes
  one into a gap between live and fetched.
- *Comments and follower lists*: one listener whose limit grows a page
  at a time. Comments read oldest first, so the end that changes is the
  last page — a growing window keeps all of it live with no seams.
  Follower lists are small and must drop a row the moment she
  unfollows. Comments stop growing at 200, the old ceiling.

**Follower lists are newest first now, not by name.** Alphabetical
across pages would mean loading everybody. Instagram is newest first.

---

## 2026-10-21 — Thumbnails are found by name, not stored on the listing

**Decision:** A Cloud Function (`makeThumbnail`) writes a 480px WebP
beside every listing and post photo, at a fixed name
(`…/thumbs/<photo>.webp`, rule in `shared/src/thumbnails.ts`). Grids
compute that address from the photo's URL and fall back to the full
photo if it is not there. Nothing is added to the listing or post.

**Why not save the thumbnail URL on the document:** the photo is
uploaded *before* the listing or post exists, so the function would
often have nowhere to write; and edits from the app rewrite `photos`,
which would quietly wipe it. A naming rule needs no document, has no
race, and makes every old photo work too (it just falls back).

**Why the URL needs no download token:** listing and post photos are
already readable by anyone (they appear in feeds), and thumbnails get
the same rule. Only the server may write them — a student uploading
her own "thumbnail" could show a different picture in the grid from the
one on the listing.

**Why WebP:** it keeps the transparency of a cut-out flat photo, which
JPEG would flatten onto black, and it is smaller.

**The phone still compresses before upload** (1600px) — that is what
keeps uploads quick on campus Wi-Fi. The thumbnail is the second size.

**Full-screen photos keep the full size** (post and listing pages, the
feed). A 480px copy would look soft there.

---

## 2026-10-21 — The word filter flags for review; it never blocks

**Decision:** Captions (new and edited), comments and messages run
through a short word list (`shared/src/contentFilter.ts`: threats,
self-harm taunts, common slurs; whole words only, with l33t and
punctuation undone). A match files an automatic report in the admin
Reports queue, marked "Automatic filter", with the words copied in.
The content is posted as normal.

**Why not block:** a word list cannot read context — a friend quoting
something, a lyric. Silently refusing a message is worse than an admin
taking a look, and Apple's 1.2 asks for filtering plus a way to act,
which the Reports queue already is.

**Not on the list (yet): Venmo, Cash App, Zelle.** Asking for payment
off the app is the marketplace's real risk, but while Stripe is off,
payments are arranged directly (Terms "Beta period"), so every rental
chat would be flagged. Add them once payments run in the app.

---

## 2026-10-21 — Deleting an account leaves a nameless shell, and keeps the handle reserved

**Decision:** "Delete my account" (Settings) runs `deleteMyAccount`. It
refuses while any rental is requested, confirmed, out, being returned or
disputed. Otherwise it removes her looks, pieces, comments, likes, saves,
follows (moving everyone else's counts back), alerts, private settings
(email, phone — which drops her from contact matching), try-on data,
profile and post photos, and finally her login. Her `users` document
stays as a "Deleted account" shell — status `deactivated`, `deletedAt`
set, no name, photo, bio or sizes — and the existing profile trigger
renames every copy of her on listings, posts, comments and chats.

**Why a shell, not a delete:** bookings and reviews point at her uid.
The Privacy Policy already says rental records are kept and reviews stay
"shown without your name", so the shell is what we promised.

**Kept, without her name:** past rentals, reviews she wrote, and chats
(the other person's copy is theirs too). Photos of a piece that was ever
rented stay, because they appear in someone's My Rentals.

**The username stays reserved** (`usernames/{old}` still points at her
uid). Releasing it would let somebody register her old handle the next
day and be mistaken for her. An admin can free it by hand if she asks.
Her shell's handle is `deleted_<id>`, a prefix signup now refuses.

**Needs a fresh password:** the app re-signs-in with her password right
before the call, and the server refuses a sign-in older than 5 minutes.

**Admins can't delete themselves from the app** — on a two-person team
that could remove the only way into the dashboard.

---

## 2026-10-21 — Messages are limited by the rules, not a function

**Decision:** Every message is written in one batch with a tick of
`messageQuotas/{uid}` — a fixed one-hour window, 500 messages. The
message rule refuses a message unless that counter moved by exactly one
in the same batch, and the counter's own rule refuses going past 500,
lowering it, or starting a new hour before the server agrees the old one
is over.

**Why not a Cloud Function:** "Messages are written by the app" (below)
still holds — a callable would add a round trip to every message. The
batch is still one round trip, so sending feels exactly as before.

**Accepted:** she can read her own counter (her phone needs it to pick
the right write). Knowing the number does not help get past it.

---

## 2026-10-21 — Deleting a chat is one-sided; requests are "never answered + not followed"

**Delete:** a thread keeps `hiddenAt[uid]` — when she deleted it. It
leaves her inbox until a newer message arrives, and then only what came
after shows. Nothing is erased: the other person keeps her copy, and
moderation can still see what was said. Her own key, server clock only.

**Mute:** `mutedUids` on the thread. A muted thread stays in the inbox
but never adds to the Messages badge (and, once push exists, should
never buzz). She may add or remove only herself.

**Requests:** a thread is a request for her when someone she does not
follow wrote to her and she has never written back. "Has written" is
`repliedUids`, kept by the onMessageCreated trigger — never the phone,
because answering is what moves a chat into the inbox. Rental threads
are never requests. Threads from before this existed are treated as
answered, so nothing anyone already had moves.

**Why not a stored "accepted" flag:** replying already says yes, and
following already says "I know her". A separate accept button would be
a third way to say the same thing.

---

## 2026-10-21 — "Seen" is one timestamp per person, not a flag per message

**Decision:** A conversation keeps `lastReadAt[uid]` — when each person
last had the thread open. "Seen" shows under the newest message when it
is hers and the other person's time is later. The phone writes its own
key only, and the rules hold it to the server clock (`request.time`).

**Why:** Marking every message read would turn opening a long thread
into a hundred writes. Instagram only ever shows one receipt, at the
bottom, so one timestamp is all the screen needs.

**Also:** a chat only counts as "open" while it is the screen in front
of her and the app is in the foreground — otherwise a chat left open
behind another screen would say "Seen" for messages nobody read.

**Not built (yet):** a setting to turn receipts off. Logged as a
suggestion.

---

## 2026-10-05 — Legal documents are append-only once published

**Decision:** Published Terms and Privacy versions live in `legalDocs` as
append-only documents. Admin drafts live separately in `legalDrafts`.

**Why:** Apple and signed-out students need public read access to the latest
legal text, but unfinished drafts should never be public. Published versions
are legal history, so they are never overwritten; publishing creates a new
version through a Cloud Function and writes an admin audit row.

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

## 2026-10-21 — A block removes the chat, even a rental's

**Decision:** Once either person blocks, the thread leaves both inboxes
and new messages and hearts are refused by the security rules — including
a thread a rental started. Social alerts (likes, comments, follows) from
a blocked person are hidden; rental alerts (due back, handoff, review)
are not.

**Why:** A blocked thread left showing would be a box she can type into
and never send from. The rental itself runs from My Rentals and never
needed the chat; the alerts that keep a rental on track stay visible so a
block cannot make someone miss a return.

**Revisit when:** blocking mid-rental turns out to be common, at which
point the rental screen might want its own "contact Loane" route.

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

---

## 2026-10-05 — The renter pays the Loane fee, 15%, $1.50 minimum

**Decision:** The fee is 15% of the rental, added on top of the price the
lender listed, with a floor of $1.50. The lender receives exactly the number
she typed. This supersedes the 2026-09-25 entry leaving it open.

**Why 15% and not 10%:** Stripe takes 2.9% + 30c of whatever the renter pays.
On a $35 dress at 10% Loane nets about $2 before any support cost. More
importantly, raising a fee after launch is the most damaging pricing move
there is — starting at 15% and running "no Loane fee for our first month" as
a promotion is strictly better than starting low and clawing upward. 15% is
also mid-market (Airbnb lands around 14–16% all-in, Turo at 15%+).

**Why the renter and not the lender:** supply is the hard side of a
marketplace, and at a single campus it is the only hard side. "List it at $35,
you get $35" is the simplest sentence in the business. Charging the lender
instead just teaches her to list at $41 to clear $35 — renters pay the same
and the listings look more expensive.

**Why a minimum:** Stripe's flat 30c eats a $5 rental. The floor is capped at
the rental price itself, so a $1 item carries a $1 fee, never $1.50.

**Still recorded per booking.** `booking.amounts.feePaidBy` and the full
breakdown are frozen onto each booking, and `calculateFees` still implements
all three splits, so a booking made under a different rule must still add up
years later.

---

## 2026-10-05 — No protection hold. A liability cap, charged only on a claim

**Decision:** Nothing is ever held against garment value. The renter saves a
card with an off-session mandate, agrees explicitly to a liability cap (the
value the lender documented) before requesting, and that card is charged only
if an admin rules her at fault on a damage or non-return claim.
`PROTECTION_HOLD_BPS` is gone; `LIABILITY_CAP_BPS` replaces it and
`booking.amounts.protectionHoldCents` became `liabilityCapCents`.

**Why:** two reasons, and the second is worse than the first.

1. Card authorizations die after about 7 days. A rental plus the 48-hour
   return window can outlive one, and nothing tells you when it lapses — we
   would believe we were covered and not be.
2. A $200 hold on a student's debit card does not "reserve" money. It makes
   $200 vanish from her available balance for a week. For a lot of students
   that is rent. It is the single most likely thing to stop her renting at
   all, which is question 1 of the MVP.

**The honest cost:** this is collection after the fact. An off-session charge
can be declined. The failure path is a Stripe payment link, renting paused,
account flagged, claim left open. We will not recover every claim — but no
design recovers every claim, and freezing hundreds of dollars of a
twenty-year-old's balance costs more renters than it saves dresses.

**Rejected alternative:** a small ($25–50) short-window refundable hold. It
fits inside 7 days and is not ruinous. It is extra moving parts for a partial
deterrent; revisit only if real damage claims actually appear.

---

## 2026-10-05 — Authorize at request, capture at pickup, pay out at completion

**Decision:** The renter's card is authorized when she requests, captured
when she confirms she has the piece in her hands, and the lender is paid
after the rental completes. Not charged at accept.

**Why:** she should not be out of pocket for a piece she has not received,
and the lender should not be paid for a handoff that never happened. Pickup
is the moment the rental actually becomes real.

**The cost, and what we do about it:** a 7-day authorization cannot span a
formal booked three weeks out. Because we hold an off-session mandate, a hold
about to lapse can be replaced without involving her — the sweep re-authorizes
inside `REAUTHORIZE_BEFORE_EXPIRY_HOURS` and counts it on the booking. Only if
that silent replacement fails does she get asked to re-confirm, and the
handoff is blocked until she does. Surprising someone at the handoff with
"your payment expired" is the outcome this exists to prevent.

---

## 2026-10-05 — Cancellation and refund rules

**Decision:**

| Who, when                                 | Result                                              |
| ----------------------------------------- | --------------------------------------------------- |
| Renter cancels before the lender accepts  | Nothing charged. Authorization released.            |
| Renter cancels 48h+ before the start date | Full refund, Loane fee included.                    |
| Renter cancels inside 48h                 | Lender keeps 50% of the rental. Loane fee refunded. |
| Lender cancels, ever                      | Renter fully refunded. Counted against the lender.  |
| Lender never answers                      | Request expires at 48h. Nothing charged.            |

**Why:** a lender who turned down other requests for a dress now sitting in
her closet on gameday is owed something. A renter who cancels a week out cost
nobody anything. And Loane never keeps a fee on a rental that did not happen —
`platformKeepsCents` is 0 in every branch of `calculateRefund`, and there is a
test asserting exactly that.

---

## 2026-10-05 — Hosted Stripe Checkout first, native payment sheet later

**Decision:** Card entry goes through Stripe's hosted Checkout page, opened
in a browser. The native `@stripe/stripe-react-native` payment sheet comes
later as a polish step.

**Why:** the native SDK is a native module, so adding it stops the whole app
running in Expo Go — including all the work that has nothing to do with
payments. Hosted Checkout works in Expo Go today, needs no build, and the
entire server side is identical either way. Swapping to the native sheet
later touches one screen.

**Cost:** she leaves the app for about twenty seconds, and there is no in-app
Apple Pay until we swap.

---

## 2026-10-05 — Building against a separate "Loane Test" Stripe account

**Decision:** Phase 5 is built and tested against a throwaway Stripe account
with Connect enabled in test mode, not the Loane, Inc. account.

**Why:** Loane, Inc.'s Stripe account cannot enable Connect until its Stripe
Atlas incorporation finishes. Waiting would block all of Phase 5 on
paperwork.

**What the swap must be:** changing keys and nothing else. No Stripe account
id, webhook id or price id is ever hardcoded — the secret key and webhook
signing secret come from Secret Manager, the publishable key from app config.
The one thing that does not survive a platform swap is per-user Stripe ids:
Connect accounts and customers belong to the platform that created them. So
`user.stripe.platformAccountId` records which platform each id came from,
making a stale id detectable and re-onboardable instead of a silent failure.
See docs/payments.md for the runbook.

---

## 2026-10-09 — The October brand palette replaces chartreuse

**Decision:** Cream `#F6EFE4` is the canvas, Merlot `#5E1A2E` the voice,
Cherry `#C8213F` the primary action, with Butter, Ballet and Denim as
secondary accents. Bright Chartreuse is gone, along with gold, terracotta
and sage.

**Why:** a new brand deck, which supersedes the September one.

**What it settles:** three colours had been marked `TODO-CONFIRM` since
September because the old deck's printed hex codes disagreed with its own
swatches. Nothing in the palette is provisional now.

**The decisions inside the decision**, since the deck gives colours and not
rules:

- **Cream is the canvas, white is for cards.** The deck labels cream
  "canvas". Making every screen cream and leaving cards white is the single
  change that does most of the work; a white card lifts off cream in a way
  it cannot off white.
- **Body text is `#231619`, not black.** A true black beside cream looks
  like a hole punched in the page. The whole neutral ramp is warmed toward
  merlot's hue for the same reason — a true grey next to cream reads dirty.
- **Cherry interrupts, Butter marks.** Cherry gets primary buttons, the +
  that creates something, unread badges and "Your turn" pills. Butter gets
  price tags, selected chips and selected dates. Two loud reds on one screen
  and neither is the primary action any more.
- **The + is cherry, not butter**, even though it is a "highlight" by
  category. Butter sits at 1.19:1 against cream, so a butter-filled circle
  would barely be a shape.
- **Butter, Ballet and Denim can never be ink.** 1.19:1, 1.59:1 and 2.69:1
  on cream. Behind near-black text they are 13.9:1, 10.4:1 and 6.1:1 and
  perfectly readable. There is deliberately no `color.text.accent` token;
  adding one would repeat exactly the mistake chartreuse made.
- **Midnight `#1A2D4D` is excluded.** The deck marks it campaign only.

**Cost of being wrong:** low. The two-layer token system meant this was
`shared/src/tokens.ts` plus a handful of screens that needed cherry instead
of butter. No screen reaches past the semantic layer, which is the whole
reason that rule exists.

---

## 2026-10-11 — The lender pays the fee, 20%. This reverses 2026-10-05

**Decision:** The renter is charged the price on the listing and nothing
else. Loane's 20% comes out of what the lender receives. A $35 dress: the
renter pays $35, the lender receives $28, Loane keeps $7.

**This overturns the decision of six days ago**, which had the renter
paying 15% on top specifically so the lender's number stayed clean. Ella's
call. Both arguments are recorded here because the question will come back.

**For it:** checkout is a single number, which is the Depop and Vinted
shape and the one this audience already knows. No fee to explain, no
surprise at the last step, and the price on the card is the price she
pays. Margin is also better — about $5.70 net after Stripe on a $35
rental, against $3.78 under the old rule.

**Against, and still true:** supply is the hard side of a marketplace and
at one campus it is the only hard side. A lender who wants $35 in hand
will list at $44, so renters end up paying roughly the same while the
listings look more expensive — the old rule's prices with none of its
honesty. 20% is also at the top of the market: Depop takes 10%, Poshmark
20%, Vinted nothing from sellers. We are at Poshmark's rate with none of
Poshmark's scale.

**Watch for:** listed prices drifting upward over the first weeks. That is
the failure mode, and it is measurable — compare median listed price on
pieces added before and after today.

**The minimum fee is gone.** It existed because Stripe's flat 30c ate a
small rental when the renter paid. At 20% off the lender, anything above
about $1.75 already clears Stripe, and a floor would take a brutal share
of a cheap rental out of her pocket.

**Two things are deliberately not treated alike:**

- **The cleaning fee passes through whole.** Loane takes nothing. It
  reimburses a dry-clean the lender actually pays for; taking a cut of a
  cost is not taking a cut of revenue. The renter must tick to agree to it
  before she can request.
- **The same-day premium splits 80/20 like the rental.** It is genuinely
  extra earnings rather than a cost, and the lender is being asked to drop
  everything and drive, so she gets the bulk of it.

**Also settled today:** lenders and sellers have 24 hours to answer, not
48. A day is long enough to be fair to someone with classes; two days is
long enough for the renter to find something else and stop caring.

---

## 2026-10-11 — Loane's own vocabulary

**Decision:** Renting is "Loane It", buying is "Own It", the CTA on a piece
for sale is "Become the owner", listing is "Put it on Loane", and a piece
currently out is "On Loane". The section once called Rentals is now On
Loane. They live in `WORDS` in shared.

**Why in a constants file:** one screen saying "Rent" while the rest says
"Loane It" is exactly what a vocabulary drifts into, and it reads as a
half-finished app rather than a brand.

**Where we did NOT apply it:** running prose. "Alex wants to Loane your
jacket" is not English. Buttons, labels and CTAs use the words exactly;
sentences stay natural and simply avoid "rent" as a verb. Ella's language
is meant to make the app sound better, not stranger.

---

## 2026-10-12 — Matching contacts without keeping anybody's contacts

**Decision:** Students can check which of their phone contacts are already
on Loane. Phone numbers are hashed on the device, compared on the server
against a peppered hash, and the request is thrown away. No address book
is ever stored.

**The chain, exactly:**

```
app     SHA-256(E.164 number)                     ← leaves the phone
server  HMAC-SHA256(key = CONTACT_MATCH_PEPPER,
                    message = that SHA-256)        ← what Firestore holds
```

**Why not a plain hash.** A US phone number is ten digits. Ten billion
possibilities is minutes of work on a laptop, so a plain SHA-256 of a
phone number is not anonymous — anyone who took the collection could
rebuild every number in it. The pepper is a server secret the app never
sees, so the stored values cannot be reversed even by somebody holding
the whole database.

**What this does NOT protect against, written down so nobody later
believes otherwise.** Whoever holds the pepper *and* the collection can
still test a specific guess: "is 803-555-0100 in here?" That is us. It is
the price of the feature existing at all, and it is why the pepper is a
secret rather than a constant in the source.

**What the app sends:** hashes only. Never raw numbers, never names,
never emails, never a contact's photo. The function reads
`fields: [PhoneNumbers]` and nothing else.

**What is stored from a request:** nothing. `matchContacts` compares and
returns. There is no collection for an address book to go into, and the
numbers are not written to the function log either.

**What comes back:** a public profile card, and deliberately NOT which
contact matched which account. She learns Anna is on Loane; she does not
learn that the number she has for Anna is the one Anna signed up with.
That difference matters to anybody with a second number they have not
given out.

**Same campus only.** Partly consistency with the rest of Loane, partly
that a cross-campus match tells her something about a person she could
not otherwise learn.

**`phoneHashes` is sealed in the security rules** — no read, no write, not
even for an admin. Read access would hand a student a one-guess-at-a-time
oracle, which is the exact thing the pepper exists to prevent. Write
access would let somebody point another person's number at her own
account and be matched by all of their friends. Five rules tests fence it.

**She can take it back.** Removing her number in Settings deletes her
`phoneHashes` entry through the `syncPhoneHash` trigger, and from that
moment nobody's contacts match her. The confirmation says what stops
happening rather than just "Remove".

**Rotating the pepper** invalidates every stored hash. They rebuild from
each user's own number, so a rotation means a backfill, not data loss.

**Set the secret before this works in production:**

```bash
firebase functions:secrets:set CONTACT_MATCH_PEPPER --project loane-code
```

Under the emulator it falls back to a fixed development value that is not
a secret and must never be the production one.

---

## 2026-10-12 — Only ask when it matters

**Decision:** Browsing, liking, following, commenting and saving require
nothing. Posting a look requires a profile photo. Putting a piece on
Loane, Loane It and Own It require a photo and a phone number. Nothing
else is gated.

**Why those three and not a "complete your profile before you start"
wall:** each has a reason you can say out loud to the person being
asked. Her face is on the post. Somebody is about to meet her in person
to hand over a garment. "Complete your profile" is not a reason, it is
an instruction.

**One place owns the rule.** `REQUIREMENTS` in
`mobile/src/hooks/useProfileGate.ts`. A fourth gated action goes there,
not into a new `if (!profile.photoUrl)` in a screen — that is how three
screens end up disagreeing about what is required.

**The sheet does not navigate.** It opens over whatever she was looking
at, asks for exactly what is missing, and then performs the original
tap. Sending her to Edit Profile and leaving her there, having forgotten
what she was doing, is the thing this exists to avoid. "Not now" always
closes it; she loses only the action she just started.

**Where the gate sits differs on purpose.** Entry points for buttons
that only open a screen. SUBMIT for the two listing forms — she has
filled out the whole thing by then, and stopping her at the door would
have been cheaper for us and worse for her. Gating at submit also
covers reaching those forms by deep link.

**The app's sheet is a prompt. The rule lives on the server.** Added
2026-10-12: `requireHandoffReady` in `backend/functions/src/lib/guards.ts`
refuses `requestBooking` and an accepting `respondToBooking` when the
caller has no profile photo or no phone number. The sheet is for her;
the guard is the actual rule, and an old build or a replayed call
cannot get round it.

Checked per ACTOR, not per booking, so the person told is the person
who can fix it — a renter blocked by her lender's missing phone number
gets an error she can do nothing about. Declining a request needs
nothing: somebody with an unfinished profile must still be able to say
no.

**LISTING IS NO LONGER GATED AT ALL.** Amended 2026-10-12, Zack's
call, and it follows the reasoning already written here: nobody is
meeting anybody at the moment a garment is listed. Asking for a photo
and a phone number at the door of the thing the marketplace needs more
of — before anyone has agreed to anything — was the gate forgetting
what it was for.

She is asked when somebody actually rents or buys the piece, which is
the moment a handoff exists, and that one IS enforced on the server.
The weaker, earlier version of this note said listings were "still
only a prompt"; they are now not even that.

---

## 2026-10-12 — AI try-on: the gate, the processor, and what launches

The full brief is `docs/try-on-plan.md`. This is the reasoning, recorded
where people look for reasoning rather than only in a build plan.

### The flat-photo gate

**Decision:** "Try it on" appears only on a listing that has a clean
*lay it flat, just this piece* photo. No warning, no disclaimer, no
"results may vary" — without one the button is simply absent.

**Why, and this is the finding the whole feature rests on.** Phase 0 ran
eleven generations against our own seeded photos. One garment on a plain
background was genuinely good — the cream poncho kept its fringe, the
rust bomber kept its zip and ribbed collar. More than one garment in
frame failed in two ways, and **the quiet one is worse**: given a whole
clothes rail it picked one garment and rendered it beautifully, with no
way for a student to know she was looking at the wrong dress. A shelf of
jeans produced shorts. Three garments on one hanger produced a
colour-blocked mess.

**Nine of our fifteen seeded listing photos are in the failing category.**
A disclaimer does not fix a confidently wrong image. Removing the button
does.

### FASHN direct, not a reseller

**Decision:** FASHN try-on v1.6, called straight from our Cloud
Function.

fal.ai resells the identical model at the identical price and adds a
second company holding photographs of students' bodies, with self-serve
accounts that retain generations indefinitely. That is the entire reason
it lost. Google's Vertex `virtual-try-on-001` is 20% cheaper and we are
already a Google customer — genuinely tempting — but its docs do not
confirm bottoms or dresses, it has no equivalent of the on-body garment
parameter, and it carries a published discontinuation date of 20 January
2027. Replicate's IDM-VTON, the one everyone benchmarks, is licensed
non-commercial and cannot be shipped at all.

**One processor, a written promise not to train on our content, and a
parameter that shrinks how long they hold an image.** For photographs of
students' bodies that is worth more than 20%.

### Tops, Outerwear and Dresses. Not Bottoms

Three of our categories, two of FASHN's. Bottoms desaturated and bled
colour at the hem in both layering tests, so they show "Coming soon"
rather than being hidden — students should see where this is going.
Sets wait for Bottoms: a set is really a layering case wearing a
different hat.

**Underwear and swimwear are excluded structurally, not by a filter.**
They are absent from `TRYON_CATEGORY_MAP`, so they are never eligible in
the first place. FASHN's `moderation_level: 'conservative'` is a
backstop for a mis-tagged listing, not the control.

### A dress over trousers leaves the trousers on

Not a bug we can fix in code. It is why the camera screen says **"wear
fitted clothes — loose clothing shows through"**, and why that line is
on the camera rather than in a help article nobody reads.

### The cache is the cost model

Same body plus the same pieces in the same order returns the stored
result and spends nothing. The key includes **the updatedAt of each
listing's flat photo**, so replacing a photo misses every cached result
for that garment — a cache that serves images of a photo that no longer
exists is worse than no cache.

Preset bodies hash to just the preset id, so **a preset result is shared
across the whole campus**: one dress on Preset B is generated once,
forever. That is the main argument for presets existing beyond
accessibility.

### Privacy: her body photo is the most sensitive thing this app holds

- Body photos and results are **owner-read only in Storage**, which is a
  new shape in this repo — every other path is readable by any signed-in
  student because listings and posts appear in feeds. These must not be
  copied from the rules above them.
- **Admins get nothing.** No admin read rule, no admin UI that renders
  one. If a damage claim ever needs one, that is a conversation to have
  then, with her consent, not a door left open.
- Nothing from `tryOns` is denormalized anywhere another student can
  read. No counters, no "3 friends tried this on".
- **No sharing at all in Phase 1**, not even a share sheet.
- She confirms "This is a photo of me" before upload, and the timestamp
  is recorded.
- One tap in Settings deletes the photo, every look and every file.

### Preset models are ours, with three conditions

FASHN's terms assign us the outputs for commercial use, so we can
generate three preset bodies and ship them. But: there is no uniqueness
guarantee (acceptable — they are furniture, not brand marks), no
IP-infringement guarantee (so each one is reviewed and anything reading
as a recognisable person is rejected), and **`face_reference` is never
used** — that would mean basing a preset on a real person's face.

Labelled by build only: **Petite / Medium / Curve**. Never a number,
never a name. They are not characters.

**Zack and Ella sign off before they ship.** They are brand assets every
student will see.

### "My Try-Ons", because "Looks" is taken

Saved already has a Looks tab and it means saved posts. A saved post is
someone else's outfit she liked; a saved try-on is her own body wearing
a garment. Overloading one tab with both is a privacy smell and a
usability one, so try-ons get a third tab.

### Changed from the plan: the free limit ships now

The plan put the 5-per-week allowance in Phase 2 alongside paid credits.
Zack's call, 2026-10-12: **build the free limit now, leave purchases
off.** The two are separable — a cap protects the bill from the day the
feature is on, whereas selling credits needs Apple IAP, Terms v2 and
prices. An admin on/off switch ships with it, defaulting to off.

### Measured as a funnel, not as a toy

When she taps Loane It or Own It from a try-on, it fires the existing
`listing_view` with `surface: 'tryon'` — **not a bespoke event**. That
makes try-on → rental directly comparable with feed → rental and post →
rental, which is the second question the MVP has to answer. A new event
would sit outside every funnel we have. `tryon_generate` records whether
it was a cache hit, because the hit rate is what decides whether paid
credits can ever work.

---

## 2026-10-12 — Saved is the fitting room

**Decision:** Saved is the main way into try-on. A button at the top —
"Try on your saved pieces" — opens the Try-On screen showing only what
she has saved, and every saved piece card carries a small "Try on" that
opens with that piece already on her.

**Why Saved and not Discover.** She has already shortlisted these. A
fitting room is for the things you were thinking about anyway, not for
browsing, and the shortlist is the closest thing Loane has to the pile
of clothes over your arm.

**Both kinds of saved count.** Pieces she hearted, and pieces tagged in
looks she saved. A dress she starred on somebody's gameday post is a
dress she is interested in, and making her go and find the listing to
save it again is busywork. The seed now creates saved looks too —
without them that whole second source was untestable and looked like it
worked only because the first source filled the row.

**AMENDS THE FLAT-PHOTO GATE, for this screen only.** The gate entry
above says a piece without a flat photo is simply absent, and
explicitly not greyed out. In the fitting room it IS shown, greyed,
saying "No try-on photo yet."

The two are not in conflict once you say what the gate is for. It
exists so nobody is shown a confidently wrong image of a garment — and
a greyed-out, unpressable card shows no image and makes no claim. In a
browse, absence is right: she never knew the piece was there. Among her
OWN saved things, absence reads as broken, because she knows exactly
what she saved and half of it has vanished. Zack's call, and the right
one.

**The server gate is unchanged.** `generateTryOn` still refuses a piece
with no flat photo. Greying out is a display decision; nothing about
what can actually be generated moved.

**No body photo yet, and she taps Try on:** camera first, then straight
back to her saved pieces — not back to where she started. Taking a
photo is a step on the way to something, never the thing itself.

---

## 2026-10-12 — The preset bodies are Female and Male, and they are ours

**Decision:** two presets, Female and Male, generated by Zack and
bundled with the app. FASHN's `model-create` is not used.

**Provenance — ⚠️ ONE GAP, DELIBERATELY LEFT OPEN.** Zack generated
both images himself with a tool he states permits commercial use, and
asked for that to be recorded here. **He wrote "[tool name]" as a
placeholder and did not fill it in, so the tool is not recorded.** It
is not written down from a guess: which tool made them is exactly the
fact that would matter if ownership were ever questioned, and a
plausible-sounding wrong answer in this file is worse than a blank.

**TODO: Zack to name the tool, and this entry updated.** Until then
what we can say is: generated by Zack, not by FASHN, commercial use
stated as permitted by him.

The constraints from the earlier plan still hold and were met by the
images supplied: full body head to feet, standing square to camera,
plain pale background, fitted neutral clothing — which is not a style
choice but what stops a dress rendering over trousers — and no
`face_reference` anywhere near them, since that would mean basing a
preset on a real person's face.

**Labelled Female and Male.** Plainly, with no names. They are
furniture, not characters.

**Replaces Petite / Medium / Curve.** That set was about build; this
one is about who the student is. A curvier model is a straightforward
addition when we want one — see below.

**Adding a preset is a list and an image.** `TRYON_PRESETS` in shared,
a label beside it, and the file in both
`mobile/assets/tryon-presets/` and
`backend/functions/assets/tryon-presets/`. `PresetId` is derived from
the list rather than written out again, so the type cannot drift. No
screen, hook or Cloud Function changes.

**They are shared, and that is the point.** A preset cache key carries
no uid, so one dress on the Female model is generated once for the
whole campus and is free for everybody afterwards. It is the main
argument for presets existing beyond accessibility, and it is why
trying a piece on a model is usually instant.

---

## 2026-10-12 — Demo garments, and Bottoms are turned on

**Provenance.** The two presets and the fifteen demo garments were
generated by Zack in **ChatGPT**, which he states permits commercial
use. Recorded as he asked. *(He wrote "[ChatGPT / tool name]" — I have
read that as ChatGPT. If it was something else, this line is the one to
correct.)* They supersede the earlier Unsplash placeholders for
anything try-on touches.

**Categorised from the images, not the filenames**, which is what Zack
asked for: 4 tops, 1 outerwear, 6 dresses, 4 bottoms. No sets.

**One file is both the listing photo and the flat photo.** The card and
the try-on cannot show different garments, because there is only one
image. That mismatch is this feature's worst failure and we have
already shipped it once — a seeded "Black Satin Slip Dress" carrying a
photo of a blue chambray shirt.

**Resized to 760px before inlining.** Firestore caps a document at 1MB
and a listing carries the image twice; the originals at 1.5–3MB would
not have fit.

### Bottoms are ON

**Decision:** bottoms can be tried on. `TRYON_COMING_SOON` is now
shoes only.

Phase 0 kept bottoms out because they desaturated and bled colour at
the hem, twice. The retest says that was the INPUT, not the category.
Two things changed:

- `segmentation_free: false`, which also fixed dress-over-trousers
- real lay-it-flat product shots, instead of photographs of bottoms
  being worn by somebody else

Eight generations — jeans, frayed denim shorts, grey sweat shorts and
gingham ruffle shorts, on both presets. Correct colour, correct hem,
no bleeding, on all eight. `scripts/tryOnBottomsTest.ts` reruns it.

**What this unlocks:** layering becomes reachable. The dressing room
already had a bottom slot with nothing able to fill it, so a top over
bottoms now works with no change to that logic — and a dress still
replaces both.

**Shoes stay off.** They have never been tested at all. Run the
harness before turning them on, the way bottoms were.

---

## 2026-10-13 — Try-on is off for v1, and comes back in v2

**Decision:** AI try-on does not launch. Every way into it is hidden
behind one switch. No code is deleted.

**Why one switch and not a branch or a delete:** the feature works. It
generates, it caches across the campus, the privacy rules are tested,
and the bottoms retest passed. Deleting that to put it back in a month
would cost more than it saved, and a long-lived branch would rot
against everything else that is still moving. A flag that defaults to
off is the cheapest honest way to say "not yet".

**Hidden, not disabled.** No greyed buttons, no "coming soon". With
the switch off it should look like try-on was never built: no "Try it
on" on a listing, no fitting-room banner in Saved, no "Try this look
on" in the feed, no My Try-Ons tab, no try-on row in Settings, no
lay-it-flat step when adding a piece, and nothing in the walkthrough.

### To turn it back on

1. **Admin dashboard → Overview → AI Try-On → "Turn on for everyone"**,
   with a reason. That is the whole switch for a running environment.
   For a dry run first, use **"Allow admin preview"** instead, which
   turns it on only for admin accounts.
2. **Set the keys**, if they are not already set on that project:
   ```bash
   firebase functions:secrets:set FASHN_API_KEY --project loane-code
   firebase functions:secrets:set ANTHROPIC_API_KEY --project loane-code
   ```
   Without FASHN nothing generates. Without ANTHROPIC the photo check
   is skipped and photos are let through — it fails open by design.
3. **Flip the seed default** in `backend/functions/scripts/seed.ts`
   (`config/tryOn` → `enabled: true`) so local environments match.
4. **Put the legal text back.** `backend/functions/src/legal/v2-tryon.ts`
   holds the Terms and Privacy clauses, finished, with paste
   instructions at the top. Then re-run
   `scripts/seedLegalV2Draft.ts` and review in admin.
   **Do not turn try-on on for students before this is published** —
   it is the clause that says we hold a photograph of her body.
5. **Re-run the harness** if anything about the model or the prompts
   changed in between: `scripts/tryOnQualityTest.ts`, and
   `scripts/tryOnBottomsTest.ts` for bottoms.

### Cancelled, not postponed

"Make it try-on ready" and the try-on post photos were already built
before this decision. They are not being extended, and they are hidden
with everything else. Noted so nobody reads the backlog later and
thinks they are outstanding work.

### What stays visible, deliberately

The **flat photo field** remains on the Listing type and on seeded
demo garments, and the demo garments remain the listing photos. They
are good product shots in their own right, and ripping them out would
make the seeded marketplace worse to look at for no gain.

---

## 2026-10-13 — Email verification is paused, App Check waits for a build

### Email verification (OTP): built, switched off, paused

**Decision:** the backend stays, the flag stays off, and the screens
are not built yet. Zack's call.

**What exists:** `sendVerificationCode` and `confirmVerificationCode`,
a 6-digit code hashed with her uid, a 10-minute expiry, five sends an
hour, five wrong guesses before the code dies, and
`requireVerifiedStudent` refusing unconfirmed students — all behind
`config/verification.required`, which is **false**.

**A code, never a link**, and this is the part not to lose: university
mail systems run scanners that follow every link in incoming mail,
which burns a one-time link before the student has opened it.

**What is left to do:**

1. Sign up for **Resend**, verify `joinloane.com` as a sending domain,
   and set `RESEND_API_KEY`. Free to 3,000 emails/month, then $20 for
   50,000.
2. Build the two screens: a "check your email" step after sign-up with
   six boxes and a resend, and a way back into it for somebody who
   closed the app midway.
3. Decide what an unverified student may still do. Today the guard is
   all-or-nothing; browsing while unverified may be the kinder shape.
4. Send one real code to a real `sc.edu` address and confirm it
   arrives and is not filtered. **Only then** flip
   `config/verification.required`.
5. Seeded accounts are already marked confirmed, so turning it on does
   not lock the test accounts out.

**Why it is paused rather than finished:** it cannot be switched on
without a mail provider and a domain record, and half a flow behind a
flag that nobody can test is not worth the screens yet.

### App Check: waits for the development build

**It does not work in Expo Go**, which is how the app is being run
today. Adding it now would mean either turning it off in development —
so it is never actually exercised — or breaking the only way Zack can
look at the app.

It goes in with the development build, alongside push notifications,
which are blocked on exactly the same thing. Until then the rate
limits below are the protection.

### Rate limits: in, on everything that creates

Set so a normal student never meets one. **If a real student ever hits
one, the number is wrong and should be raised rather than defended** —
each one logs a warning precisely so we find that out.

One gap, stated rather than hidden: **chat messages are not rate
limited**, because they are written by the app directly under the
security rules and there is no function to limit. Starting a
conversation is limited; the messages inside it are not. Closing that
means either moving sends behind a function or relying on App Check.

## 2026-10-13 — The new mark

Two overlapping outline rings became **two filled circles overlapping
in butter**: a pale ballet circle with a ballet ring on the left, a
cherry circle with a merlot ring on the right.

**Why the lens matters.** The overlap is a colour neither circle has on
its own, which is the product in one shape — two closets, and the thing
that only exists where they meet. It is also the first mark we have had
that is recognisable at 29pt.

**The letters came off the circles.** The old lockup sat L O A N E
across two outlines, which worked because the rings were empty. On
filled circles the L and the O land on cherry and disappear. The
wordmark now always sits underneath, and `lockup="across"` resolves to
`below` so nothing had to be renamed in a hurry.

**One file holds the geometry.** `brand/generate-brand.py` writes the
SVG artwork, both web copies and every PNG from the same constants, and
`mobile/src/components/Logo.tsx` draws the mark on screen with the same
two ratios under the same names. The old mark drifted precisely because
the icon was redrawn by hand at a different stroke weight than the
logo, and the two quietly stopped being the same drawing.

**Colours are all existing tokens** — balletSoft, ballet, cherry,
merlot, butter — gathered under `color.logo` rather than reused from
`color.role`, so reading the mark never looks like it means lender or
renter.

**Open:** the pale pink fill is `balletSoft`. If the pink in Zack's
reference is deeper than that, it is one constant in one file.

## 2026-10-22 — Every callable goes through one safety net (autopilot run 12)

Every Cloud Function the app calls now imports `onCall` from
`backend/functions/src/lib/callable.ts` instead of from firebase-functions.
Same signature; the difference is what happens when a handler throws
something that isn't a deliberate `HttpsError`.

**Before:** Firebase turned it into the bare word "INTERNAL", the app showed
a vague fallback, and the log had no idea which call or which student it
came from.

**Now:** retryable database errors (timeout, contention, unavailable) reach
her as "Loane is busy right now. Try again in a moment." Anything else
reads "Something went wrong on our side… send us this code: 3f9a1c", and
the log gets one structured line (`fn`, `uid`, `ref`, the raw error) with
the same code. A screenshot is enough to find the log line. Deliberate
`HttpsError`s pass straight through, and the request data is never logged
because it can hold messages, emails or phone hashes.

**Rule for new callables:** import `onCall` from `lib/callable`, never from
`firebase-functions/v2/https`.

## 2026-10-22 — Crash reporting is wired in and switched off (autopilot run 12)

`mobile/src/monitoring/crashReporter.ts` is the one place crashes go.
`CRASH_REPORTING_ENABLED` is `false`, so nothing is sent anywhere until Zack
picks a provider (Sentry's free tier is the obvious first choice; it needs a
development build, like push notifications). Turning it on touches that one
file. A screen that crashes now shows "Something went wrong" with Try again
and Back to the feed (`CrashScreen`, exported as the root layout's
`ErrorBoundary`) instead of a white screen.

Reports identify a student by uid only — never email, name, messages or
photos — so the App Store privacy form doesn't grow.

On the server, nothing extra is needed: Google Cloud Error Reporting already
groups every `logger.error` that carries a stack, which the callable safety
net (above) now writes for every unexpected failure.

---

## 2026-10-22 — One switchboard for risky features (autopilot run 13)

**Decision:** every risky or unfinished feature has one on/off switch,
all in one Firestore document, `config/features`, shown on one panel in
the admin dashboard (Overview → Feature switches). The switches:
try-on, try-on admin preview, email codes at sign-up, same-day pickup,
payments. What each means and its default is in
`shared/src/featureFlags.ts`.

**Nothing changed state.** The defaults are exactly what was true
before: try-on off (admins included), email codes off, same-day on,
payments off. A missing or garbled document gives those defaults, and a
value that isn't a real true/false (e.g. the text "true" typed in the
console) is ignored.

**Two switches are locked on purpose.** Email codes and payments can be
turned OFF from the dashboard but not ON: turning on email codes with no
email service locks every new student out, and turning on payments with
no Stripe account helps nobody. Unlocking either is a one-line code
change (`lockedReason: null`) made when the setup is real.

**The old documents are no longer read.** `config/tryOn` and
`config/verification` were replaced by fields on `config/features`
(`tryOn`, `tryOnAdminPreview`, `emailVerification`). On the live
project, after the next deploy, the dashboard will show the defaults
above; if try-on admin preview had been switched on there, switch it on
again from the new panel. The `setTryOnConfig` function still exists
(it is deployed) and now writes the same document.

**Same-day off means:** the "Available same day" toggle is hidden when
listing a piece (her saved choice is kept), the request screen says
same-day is paused if she picks today, and the server refuses a request
for today.

**Payments:** nothing calls Stripe yet. `assertPaymentsOn()` in
`backend/functions/src/lib/stripe.ts` is the first line every money
function must call.

---

## 2026-10-22 — "Download my data", and how a privacy request is answered (autopilot run 13)

**Decision:** one server function gathers everything Loane holds about a
student into one JSON file (`backend/functions/src/privacy/exportUserData.ts`).
Two ways in: she taps **Settings → Download my data** (three a day), or
an admin taps **Export her data** on a student's page in the dashboard
(needs a reason, leaves an audit row). Deleting is the existing
**Delete my account**, so a privacy request is now: export, then — if
she asks — she deletes, or we walk her through it.

**What's in it:** profile, private settings (email, phone), alerts,
blocked and muted lists, pieces, looks, comments, likes, saves, follows
both ways, rentals both sides, reviews by and about her, reports she
filed, help requests, try-ons, every chat with its messages (both
sides, like Instagram's export), and her activity events.

**Left out on purpose:** the hashed sign-up code (a security secret),
rate-limit counters, our private admin notes about her, and who handled
her reports and their notes on them (she still sees what was done).
Photos are listed as links, not bundled — a zip is a later improvement
if anybody asks.

**Not built:** an admin button that deletes a student's account for
her. Today a privacy deletion is her own "Delete my account"; an admin
version means reworking the deletion code, which has its own run.

## 2026-10-22 — The "For You" score runs on her phone, from numbers she cannot fake (autopilot run 15)

The ranking score (NORTH_STAR D2) is a pure function in
`shared/src/feedRanking.ts`, run on the phone over a page of the newest
campus looks, rather than a server job that writes a score onto every
post every few minutes.

- **Why not the server:** a stored score is one more server-written
  number per look, recomputed on a timer, and it still could not be
  personal — "who" and "what" are different for every student. A
  per-student server feed is a real cost (a write per student per look)
  for a campus that will have hundreds of looks, not millions.
- **Why the phone is safe:** the personal parts (who she follows, what
  she likes) only reorder her own feed. The parts that would let someone
  push a look up other people's feeds — quality and availability — read
  only server-written counters and listings the rules lock. Phone-written
  events (impressions, dwell) are deliberately left out until they are
  counted on the server with a per-person ceiling.
- **When to revisit:** if a campus passes a few thousand active looks,
  or once we want impressions in the quality score. Then a scheduled
  function computes the look-side parts and the phone adds the personal
  ones.
- Every weight is in `FEED_RANKING`; `scripts/explainFeed.ts` prints why
  each look ranked where it did, using the same function as the app.
