# Loane data model

Every collection in Firestore, what it is for, who may write it, and why it is
shaped the way it is.

The TypeScript definitions in [`shared/src/types/`](../shared/src/types/) are
the source of truth. This document explains them. If the two ever disagree,
the code is right and this file needs updating.

## Ground rules

1. **One source of truth.** Types live in `@loane/shared` and nowhere else.
   Mobile, admin and Cloud Functions all import the same definitions.
2. **Money is always an integer number of US cents.** Never a float, never a
   string. `4500` means $45.00.
3. **Dates for rentals are plain calendar dates** (`"2026-10-04"`), not
   timestamps. A booking runs from `startDate` up to but **not including**
   `endDate` — the item is free again on the end date.
4. **Everything is scoped to a campus.** Listings, posts and bookings all
   carry a `campusId`. That is what keeps a USC student's feed full of USC
   closets.
5. **Anything involving money, trust, counts or verification is written only
   by Cloud Functions.** The app can never write it directly, even if someone
   reverse-engineers the API. See [security.md](./security.md).
6. **Denormalization is deliberate.** A listing carries a small copy of its
   owner (`UserSummary`) so a grid of 30 listings is one read, not 31. Cloud
   Functions keep those copies fresh.

## Collections at a glance

| Collection | What it holds | Who writes it |
|---|---|---|
| `campuses` | Approved schools and their email domains | Admin only |
| `users` | Public profile, stats, verification state | Owner (limited fields) + Functions |
| `users/{uid}/private/settings` | Contact info, notification preferences | Owner only |
| `users/{uid}/blocked/{uid}` | Blocked users *(Phase 6)* | Owner only |
| `users/{uid}/notifications/*` | Activity feed rows | Functions only |
| `usernames` | Uniqueness locks | Functions only |
| `listings` | Garments in closets | Owner + Functions |
| `posts` | Outfit posts, with tagged listings | Author + Functions |
| `follows` | Who follows whom | Functions only |
| `likes` | Post likes | Functions only |
| `postSaves` | Saved looks | Functions only |
| `comments` | Comments on a look | Functions only |
| `saves` | Saved listings (wishlist) | Functions only |
| `bookings` | Rentals and purchases | **Functions only** |
| `reviews` | Post-rental ratings | Functions only |
| `conversations` + `messages` | 1:1 DMs | Participants + Functions |
| `reports` | Flagged users, listings, posts | Functions only; admins read |
| `damageClaims` | Damage and non-return claims | Functions only; admins decide |
| `adminActions` | Append-only admin audit log | Functions only |
| `events` | Engagement tracking | App creates; nobody reads but admins |
| `circles` | Sororities / friend groups *(designed, not built)* | — |

---

## `campuses/{campusId}`

The approved-school list. A signup email's domain is checked against
`emailDomains` to decide which campus a student belongs to.

Launch campus id: **`university-of-south-carolina`**, domains `sc.edu` and
`email.sc.edu`.

We use the full slug as the id, never `"usc"` — "USC" is genuinely ambiguous
(University of South Carolina vs University of Southern California) and that
ambiguity would eventually cause a real bug.

`stats` (user count, listing count, etc.) is maintained by Cloud Functions and
feeds the admin dashboard's overview metrics.

## `users/{uid}`

The document id is the Firebase Auth uid.

**She may edit:** `firstName`, `displayName`, `bio`, `photoUrl`, `sizes`,
`pushTokens`.

**Only Cloud Functions may write:** `username`, `campusId`, `isVerified`,
`verificationMethod`, `role`, `status`, `stats.*`, `isFoundingCloset`,
`stripe.*`. If the app could write `isVerified` or `stats.ratingAverage`, the
whole trust system would be decoration.

### On `isVerified`

At MVP, `isVerified` is set to `true` as soon as the email a student types
matches an approved campus domain. **We do not yet send a confirmation
email**, so this proves she *typed* a campus address, not that she *has* one.

The field exists now, is written now, and is read by everything that should
eventually be gated on it. Nothing is blocked on it yet. Sending a real
confirmation code is a **must-do before beta launch** — see
[roadmap.md](./roadmap.md). When we turn it on, only the Cloud Function
changes; no documents migrate.

`verificationMethod` records *how* she was verified (`domain_claimed` today,
`email_confirmed` later, `manual_admin` for founding closets), so after we
ship real verification we can tell which accounts still need re-checking.

### `users/{uid}/private/settings`

Contact details, phone, handoff notes and notification preferences. Separate
from the public profile so a stranger reading a user document never sees a
phone number.

## `usernames/{username}`

A tiny lock document: `{ username, uid, createdAt }`.

Firestore cannot enforce "this field must be unique". The standard fix is a
second collection where the *document id* is the thing that must be unique.
Claiming a username is a transaction: create `usernames/ella` and set
`users/{uid}.username` together, or neither happens.

## `listings/{listingId}`

One garment. Carries photos, brand, size, category, condition, occasion tags,
3-day and 7-day rental prices, sale price, and `garmentValueCents`.

`garmentValueCents` is required for anything rentable — it sets the protection
hold and caps what a renter can be charged for damage.

`intent` is `rent`, `sell` or `both`, matching the three-way toggle on the
Add to Closet screen.

`blackoutDates` holds days the owner manually marked unavailable. Days blocked
by a **confirmed booking are deliberately not stored here** — they are derived
from the `bookings` collection at request time inside a transaction. Two
places recording the same truth is how double-bookings happen.

## `posts/{postId}`

An outfit post. Carries photos, a caption, occasion tags, and
`taggedListings` — the bridge from "cute outfit" to "rent this".

Tagged listings are stored twice on purpose: `taggedListings` holds small
denormalized copies so the tap-through renders instantly, and
`taggedListingIds` holds bare ids because Firestore's `array-contains` only
works on scalars.

`lastLiker` is the most recent person to like the look, stored on the post
so the "Liked by Harper and 12 others" line costs the feed nothing. The
alternative — a likes query plus a profile read for every post scrolling
past — is two extra reads per post to print one name. It is cleared when
that same person un-likes, because we do not know who liked it before her
and a name belonging to somebody who took their like back is worse than
showing the count alone.

The expanded "See tagged pieces" panel deliberately does NOT use the
denormalized copies. It reads the listings live, because it shows size,
price and description — exactly the fields an owner edits — and it costs
nothing until somebody opens it.

`stats.tagTapCount` counts taps from a post through to a listing. **This is the
single most important number for MVP question 2** — it is the direct measure
of the social side driving marketplace activity.

## `follows`, `likes`, `postSaves`, `saves`

All four use a **compound document id** — `{uid}_{postId}`,
`{followerUid}_{followingUid}`, and so on.

This means a double-like is not something we have to check for; it is
impossible by construction. Writing the same id twice is one document, not
two. It also makes "has she already liked this?" a single cheap read.

A Cloud Function watches these collections and keeps the counters on the
parent user/post/listing accurate.

## `bookings/{bookingId}`

**Never written directly by the app. Ever.**

A booking is created by a callable Cloud Function that runs a Firestore
transaction:

1. Read the listing. Confirm it is active and rentable.
2. Read every booking for that listing whose status blocks the calendar
   (`confirmed`, `with_renter`, `disputed`).
3. If any overlaps the requested dates, abort.
4. Check the requested range against `blackoutDates`.
5. Create the booking.

Because this runs inside a transaction, two girls tapping "request" for the
same dress on the same gameday weekend at the same instant cannot both
succeed. One wins, one gets a clear error. This is tested — see
[architecture.md](./architecture.md).

**Note that `requested` does not block the calendar.** Only `confirmed` does.
A lender can receive three requests for one weekend and choose.

### Status flow

```
requested ──accept──> confirmed ──handoff──> with_renter ──return──> returned ──> completed
    │                     │                       │
    └──decline──> declined└──cancel──> cancelled  └──claim──> disputed
```

`amounts` records the full fee split **at the moment of booking**, including
`feePaidBy`. Changing our fee percentage later therefore never rewrites past
bookings. (Who actually absorbs the fee — renter, lender or split — is still
undecided; the default is `renter`.)

## `reviews/{reviewId}`

Written only by a Cloud Function, and only by someone who actually completed
the booking being reviewed. That single rule is what separates a real rating
system from a fake one.

## `comments`

Top-level rather than a subcollection of the post, because admins need to
sweep every comment on the platform and a collection-group query needs an
index of its own where a plain collection does not.

Written only by `addComment` / `deleteComment`, for two reasons rules cannot
cover: the count under the post has to move with the comment, and the name
and photo stamped on it have to really be hers. If the app could write
those, anyone could leave a comment signed by somebody else.

Soft-deleted like everything else. `removed` is what she chose, `suspended`
is what an admin did, and a comment somebody reported still exists when an
admin goes looking for it. Both the author of the comment and the author of
the look can remove one — clearing something nasty off her own post should
not mean waiting on us.

## `conversations` + `conversations/{id}/messages`

1:1 only for MVP. The conversation id is the two uids sorted and joined with
`_`, so the same pair can never end up with two separate threads.

A message may carry a `sharedPost`: a look somebody sent into the chat,
stored as a snapshot rather than just a post id so the bubble renders
immediately and does not turn into a blank card if the post later comes
down. Tapping it opens the live post, which is where the truth is. Only
`sharePost` may write one — it moves the post's share count — so the rules
refuse any app-written message whose `sharedPost` is not null.

## `reports` and `damageClaims`

Both are created by Cloud Functions and readable only by admins — a reported
user must never be able to see who reported her.

`damageClaims` carries a `claimWindowEndsAt` stamped 48 hours after return, so
late claims are rejected by rule rather than by judgement.

## `adminActions`

Append-only. Every admin action writes one row with before/after snapshots, so
we can always answer "who suspended this account, when, and why".

## `events/{eventId}`

Engagement tracking, logged from day one.

The app may **create** an event and may never read, update or delete one.

These exist to answer the two MVP questions:

**1. Will girls rent from closets on their campus?**
`listing_view` → `rental_requested` → `rental_confirmed` gives the conversion
funnel per campus.

**2. Does the social experience drive discovery, engagement and return visits?**
Every event carries a `surface` (`feed`, `discover`, `search`, `profile`…) and
a `sessionId`. That lets us compare a girl who arrived at a listing from the
feed against one who arrived from search, and measure whether social users
come back more often.

`tagged_item_tap` is the headline metric: the social feed handing the
marketplace a customer.

This same stream is what a recommendation algorithm will train on later, so we
log generously now rather than wishing we had.

## `circles/{circleId}` — designed, not built

A sorority, friend group or dorm. The type exists and `posts.circleId` has a
slot for it so nothing has to migrate when we build it. Not in the MVP.

---

## Things deliberately left open

| Open question | Where we left room | Decide by |
|---|---|---|
| Who pays the Loane fee — renter, lender, or split | `booking.amounts.feePaidBy`, written per booking | Phase 5 |
| Blocking users (separate from reporting) | `users/{uid}/blocked/{uid}` subcollection | Phase 6 |
| Exact protection hold percentage | `PROTECTION_HOLD_BPS` constant | Phase 5 |
| Instant book vs always-approve | `listing.requiresApproval`, forced `true` at MVP | Phase 4 |
