# Security rules review (C2)

Written by the overnight autopilot, run 8 (2026-10-21). Every collection
in `backend/firestore.rules`, who can read it, who can write it, and the
test in `backend/functions/src/__tests__/rules.test.ts` that proves a
student can't get at what she shouldn't. GitHub runs these tests on
every push.

"Functions only" means the app can't write it at all — a Cloud Function
does, with admin credentials, after its own checks.

| Collection | Who can read | Who can write from the app | Proved by (test group) |
|---|---|---|---|
| `campuses` | Anyone (signup needs it) | Nobody — functions only | security review |
| `legalDocs` | Anyone | Nobody, not even admins | legal documents; security review |
| `legalDrafts` | Admins | Nobody | legal documents |
| `users/{uid}` | Signed-in students | Her own safe fields only — never `isVerified`, `role`, `status`, counters | users; suspension; social counters |
| `users/{uid}/private` | Her and admins | Her own settings | private settings |
| `users/{uid}/muted` | Her only | Her only | muting |
| `users/{uid}/blocked` | Her only | Her only | blocks |
| `users/{uid}/blockedBy` | Her only | Nobody | security review |
| `users/{uid}/adminNotes` | Admins | Nobody | admin-only data |
| `users/{uid}/notifications` | Her only | Mark read only | notifications; security review |
| `users/{uid}/dismissedSuggestions` | Her only | Her only | dismissed suggestions |
| `usernames` | Signed-in (to say "taken") | Nobody | usernames |
| `rateLimits` | Nobody | Nobody | security review |
| `messageQuotas` | Her and admins | +1 per message, can't reset early | conversations → the hourly message ceiling |
| `listingQuotas` | Her and admins | Never — retired in run 40 (new pieces are counted in `rateLimits` by `writeListing`) | listingQuotas |
| `phoneHashes` | Nobody | Nobody — functions only (contact matching) | phone hashes |
| `tryOns` | Her only | Her only (feature switched off) | try-ons |
| `config` | Signed-in | Nobody, not even admins | the try-on switch |
| `listings` | Signed-in | Never from the phone — saved by `writeListing` (run 40), which checks every field, her photos and her name | listings; listing availability; `writeListing.test.ts` |
| `posts` | Signed-in | Her own; counters never | posts; post counters |
| `comments` | Signed-in | Functions only | comments |
| `commentLikes` | Signed-in | Functions only | comment likes |
| `follows`, `likes`, `postSaves`, `saves` | Signed-in | Functions only | follows; saves; post likes and saves |
| `bookings` | The two people in it, admins | Functions only | bookings; bookings, in detail; security review |
| `reviews` | Signed-in (hidden ones admins only) | Functions only | reviews |
| `conversations` + `messages` | The two people in it | Her own messages, counted, not when blocked | conversations (many groups) |
| `reports` | The reporter, admins | Functions only | moderation; security review |
| `supportRequests` | The requester, admins | Functions only | support requests; security review |
| `damageClaims` | The two people in it, admins | Functions only | security review |
| `adminActions` | Admins | Nobody — append-only | admin-only data |
| `events` | Admins | Create only, her own uid, known types | events |
| `circles` (+ `members`) | Signed-in | Nobody (not built) | security review |
| Anything else | Nobody | Nobody | security review ("refuses any collection nobody named") |

## Known limits (not holes)

- **Events have no hourly ceiling.** A per-event counter would double the
  database writes on the busiest path in the app (every scroll logs
  impressions) and a single counter document can only take about one
  write a second, which a fast scroller would exceed. The right fix is
  App Check (Phase 8), which stops scripts entirely. Until then, analysis
  should ignore any one person's runaway numbers.
- **Storage rules** (photos) are reviewed separately in `storage.rules`
  and are not in this table.
