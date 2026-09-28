# Loane security approach

## The one rule everything else follows

**Never trust the phone.**

The app running on someone's phone can be inspected, modified and replayed.
Anything it is allowed to do, assume a determined person will eventually do
on purpose. So we decide, per piece of data, whether the app is allowed to
write it — and for anything that involves money, trust or counting, the
answer is no.

## Who can write what

### The app may write directly

| Data | Condition |
|---|---|
| Her own profile | Only her own document, and only the fields she's allowed to change (name, bio, photo, sizes) |
| Her own listings | Only where `ownerUid` is her uid |
| Her own posts | Only where `authorUid` is her uid |
| Her own messages | Only in conversations she is a participant of |
| Her private settings | Only her own subcollection |
| Events | Create only. She may never read, edit or delete one |

### Only Cloud Functions may write

- `bookings` — otherwise two people book the same dress
- `reviews` — otherwise anyone rates anyone
- `saves` — saving drives the save count owners see
- All counters: follower counts, like counts, listing counts, ratings
- `isVerified`, `verificationMethod`, `role`, `status`
- `usernames` locks
- `follows`, `likes`, `saves`, `postSaves` (so counters stay honest)
- `reports`, `damageClaims`, `adminActions`
- `campuses`
- All Stripe fields

Cloud Functions use the Admin SDK, which bypasses security rules entirely.
That is fine, because that code runs on Google's servers where nobody can
edit it. The rules exist to stop everyone *else*.

### Only admins may read

- `reports` — a reported user must never learn who reported her
- `damageClaims` (beyond the two people involved)
- `events`
- `adminActions`

## How admin works

**Every admin action is a Cloud Function, and every one writes an audit
row in the same commit as the change.** Not two writes — one batch. If
the audit row could fail on its own, we would eventually have an action
nobody can account for, which is the one thing an audit log exists to
prevent.

The dashboard never writes to Firestore directly. `adminActions` is
readable by admins and writable by nobody, including admins: an audit
log an admin can rewrite is not an audit log.

Three rules are built into suspension rather than left to whoever
clicks:

| Rule | Why |
|---|---|
| Nobody can suspend themselves | Locking yourself out of your own panel is a bad afternoon |
| Admins cannot be suspended from the panel | On a two-person team that is a foot-gun. Remove the admin claim first, deliberately |
| A suspended student can still read | She is shown a banner saying why, with an address to appeal to. Silently breaking every button is both unkind and unanswerable |

Private notes on a student live at `users/{uid}/adminNotes` and are
readable only by admins. Half the point of them is being able to write
"watch this one" honestly.



Admin is a **Firebase custom claim** — a flag attached to the account by the
server, which the account itself cannot change. Not a field in the database,
because a field in the database is something someone might find a way to
write.

```
request.auth.token.admin == true
```

The admin dashboard checks this claim at login and refuses anyone without it.
The security rules check it independently. Both checks matter: the dashboard
check is a nice error message, the rules check is the actual lock.

Setting the claim is a manual, deliberate act run from a script against a
named uid. It is never granted by anything the app does.

## Campus verification

**Today (MVP):** a student types a university email. If the domain matches an
approved campus, `isVerified` is set to `true` by a Cloud Function.

**This is deliberately weak and we know it.** Typing `anyone@sc.edu` proves
nothing — no confirmation email is sent. Zack's call was to ship the screen
now and not gate features on it.

What protects us from that being a permanent hole:

- The field, the method (`domain_claimed`) and the timestamp are all recorded
  now, so after we ship real verification we can tell exactly which accounts
  were never actually proven and re-verify them.
- Only a Cloud Function can set it, so it cannot be forged from the app even
  today.
- Every place that *should* be gated on it already reads it.

**Before beta launch** (see [roadmap.md](./roadmap.md)) we email a real
confirmation link, set `verificationMethod` to `email_confirmed`, and start
enforcing it on listing, renting and messaging. Only the function changes.

## Storage rules

Users upload to their own folders and nowhere else:

```
users/{uid}/profile/...
users/{uid}/listings/{listingId}/...
users/{uid}/posts/{postId}/...
users/{uid}/bookings/{bookingId}/...
users/{uid}/claims/{claimId}/...
```

Enforced on every upload:

- The path's `{uid}` must equal the signed-in uid
- Content type must be an image
- Maximum 8 MB per file
- Photos are compressed and resized to 1600px on the longest edge **before**
  upload, so the limit is a backstop, not the normal path

Reads are public for listing and post photos — they have to be, they show up
in feeds. Nothing private is ever put in Storage.

## Secrets

- Nothing secret is ever committed. `.env` is gitignored; every app has a
  `.env.example` showing the shape without the values.
- The **Firebase web config is not a secret.** It identifies the project, it
  does not grant access — the security rules do that. It is safe in the repo
  and safe in a shipped app. (This surprises people, so: yes, really.)
- Things that *are* secret — Stripe secret keys, service account JSON —
  never touch the repo. They live in Cloud Functions config.

## Preventing abuse

| Risk | Mitigation |
|---|---|
| Double-booking | Transaction in a Cloud Function ([architecture.md](./architecture.md)) |
| Fake reviews | Reviews only writable by a participant in a completed booking |
| Inflated stats | All counters written by functions only |
| Username squatting on someone's handle | Lock documents + reserved-name list |
| Someone taking payment off-platform | `off_platform_payment` report reason; in-app messaging keeps a record |
| Oversized or non-image uploads | Storage rules |
| A renter confirming her own booking | Every status change goes through one server-side transition table |
| A lender hiding a weekend she already promised | `bookedDates` is derived by a Cloud Function; the app cannot write it |
| Seeing who rented what | Bookings are readable only by the two people in them; the calendar reads dates only, published onto the listing |
| A forged handoff confirmation | The whole booking document is function-only |
| A listing with no photo, no occasion or no price | Required fields enforced in `firestore.rules`, mirroring `validateListingDraft` |
| Faked prices, campus, owner or counters on a listing | Create and update rules; counters must start at zero and can never be written by the app |
| Deleting a listing that has rental history | The app cannot delete or mark `removed` at all — only the `removeListing` function, which checks bookings first |
| Scripted signup floods | **TODO Phase 8:** Firebase App Check |
| Function abuse | **TODO Phase 8:** rate limiting on callable functions |

## Blocking: what it does and does not do

Blocking has two halves, and they are not equally strong. Worth
understanding before anyone relies on it.

### Actions — genuinely enforced

Messaging, renting and following between two people where **either** has
blocked the other are refused by Cloud Functions (`assertNotBlocked`).
A modified app cannot get around this. Blocking also removes any follow
between them in both directions.

### Content — filtered on the phone

Hiding her posts from your feed means **your app skips them**. Firestore
cannot express "everything on my campus except these fourteen people" in
a query, and the alternative is a per-user fan-out feed, which is a large
piece of machinery.

**So:** someone technical who blocked you could still see your public
posts if they went out of their way. Nobody casually will, and the
things that actually hurt — messaging you, renting from you, turning up
— are properly blocked. This is roughly the same seam most social apps
have.

### The one leak we accept on purpose

For her to disappear from *your* feed after she blocks you, your app has
to know she blocked you. That is why `users/{uid}/blockedBy` is readable
by its owner. It technically tells you that you were blocked.

Nothing in the interface ever says so. Her profile reads "This closet
isn't available", the same as a deleted account. A quiet boundary beats
a confrontation.

### If this becomes a real problem

The fix is a fan-out feed: a Cloud Function writes each new post into its
followers' own feed collections, and the block is applied at write time
rather than read time. That also solves the Following-tab limit. Do both
together, when scale demands it.

## What is not done yet

Named honestly so it does not get forgotten:

- **Real campus email verification.** Must-do before beta.
- **App Check.** Phase 8. Until then nothing stops someone calling our
  functions from outside the app.
- **Rate limiting.** Phase 8.
- **Content moderation of photos.** Human review through the admin reports
  queue only. No automated scanning.
- **Comments are not scanned either.** They are reportable by any student
  and an admin can take one down, but nothing reads them automatically.
  On a single campus at MVP scale that is the right trade; it will not
  hold at ten campuses.
- **Content-level blocking is client-side.** See above. This now covers
  comments too: someone she blocked is filtered out of the thread by her
  app, not by a rule.
