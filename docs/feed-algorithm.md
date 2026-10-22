# Feed algorithm ("For You")

The plan is NORTH_STAR.md section D. This file grows as each step lands.

## Step 1 — What we record (done, autopilot run 14)

Everything the ranking will learn from is an `events` row (append-only,
admin-read only, see `backend/firestore.rules`). For each signal, the
event and where it is written:

| Signal | Event | Written from |
|---|---|---|
| Saw a look in the feed, and for how long | `post_impression` — `meta.dwellMs`, `meta.position`, `meta.tab` | Feed (`usePostImpressions`) |
| Opened a look | `post_view` | Look page |
| Liked / unliked | `post_like` / `post_unlike` | `usePostEngagement` (button and double-tap) |
| Saved a look / a piece | `post_save`, `save` (and the un- versions) | `usePostEngagement`, `useSaved` |
| Commented | `comment_created` | `useComments` |
| Shared into a DM | `post_shared`, `listing_shared` | Send sheet |
| Tapped a tagged piece | `tagged_item_tap` (the headline metric) | Feed, look page |
| Opened a profile | `profile_view` — `meta.from`: `feed`, `suggested` or `other` | Profile |
| Followed / unfollowed | `follow` / `unfollow` — `meta.from`: `feed`, `suggested`, `contacts`, `following_list`, `other` | Profile, suggested closets, Find Friends, Following list |
| Asked to rent / buy | `rental_requested` (`meta.kind: 'purchase'` for Own It) | Request and Own It screens |

### Impressions: the rules

- **Once per look per app session.** Scrolling up and down the same ten
  looks must not write hundreds of rows.
- **Counted when it leaves the screen** (or when she leaves the tab,
  switches Following / All Campus, or puts the phone down), carrying the
  total time it was at least half on screen.
- **Under 300ms is a flick** and is not recorded — and not remembered, so
  if she scrolls back and really looks, that look counts.
- **Capped at 60 seconds**, so a phone left on one look does not make it
  the most-loved post on campus.
- `position` is kept so ranking can correct for the fact that the top of
  the feed is always seen most.

The logic lives in `shared/src/impressions.ts` (tested), the screen only
wires it up.

### Known limits

- Events are written by the phone, so a determined student could write
  fake ones. The rules pin them to her own uid, campus and the server's
  clock; how *many* she writes waits for App Check (Phase 8). The ranking
  should therefore weigh events per person with a ceiling, so one account
  cannot move a post's score on its own.
- An event fired before her profile has loaded is dropped (the rules
  would reject it anyway).

## Step 2 — The score (done, autopilot run 15)

Every look gets one number for one student. It is five parts, each
between 0 and 1, multiplied by a weight and added up. All the numbers
live in `FEED_RANKING` in `shared/src/feedRanking.ts` — change the feed
there and nowhere else.

| Part | Weight | What it means | Where the data comes from |
|---|---|---|---|
| **who** | 1.0 | 0.6 if she follows the author, +0.2 if they follow each other, +0.05 per look of theirs she has liked/saved/commented on (at most +0.2). Her own looks score 0. | Her follows and likes |
| **what** | 0.6 | How well the look's occasions match the occasions she engages with — her favourite occasion scores 1, others relative to it. | Occasions of looks she has liked (each occasion capped at 20) |
| **fresh** | 1.2 | 1 when just posted, halves every 36 hours. | `createdAt` |
| **quality** | 0.8 | Engagement *per viewer*, not raw likes. A like = 1, save = 2, comment = 3, share = 3, tagged-piece tap = 4, divided by (opens + likes). Smoothed as if every look started with 20 viewers at 10%, so 1 view + 1 like is not "perfect". 0.6 per viewer or better scores 1. | `post.stats` — server-written counters only |
| **available** | 0.4 | Share of the tagged pieces she could actually get this week (up, and either for sale or with at least one free day in the next 7). No tagged pieces = 0. | The listings, which she cannot edit |

### Why it runs on her phone, and why that is safe

The score is worked out on her phone over a page of the newest campus
looks (the next step wires it into the feed). That is safe because:

- **who** and **what** are about *her* — her follows, her likes. Tampering
  with them only reorders her own feed.
- **quality** and **available** are about *the look* — and come only from
  counters Cloud Functions write and listings the rules protect. Nobody
  can push their own look up somebody else's feed from their phone.
- Impressions (step 1) are phone-written, so they are **not** used in the
  score yet. When they are, they will be counted on the server with a
  ceiling per person.

### See why a look ranked where it did

With the emulators running and seeded:

```bash
cd backend/functions && npx tsx scripts/explainFeed.ts --user ellapetrickcloset
```

It prints every look in order with its five parts. It only runs against
the local emulator.

## Step 3 — Variety and discovery (done, autopilot run 16)

After scoring, `diversifyFeed` in `shared/src/feedOrder.ts` moves looks
as little as possible to obey two rules (both numbers in
`FEED_RANKING.diversity`):

- **No more than 2 in a row from the same girl** (`maxInARow`). However
  well one prolific poster scores, her third look waits a slot.
- **At least 1 in every 4 from someone she doesn't follow**
  (`discoveryEvery`), while any are left. Her own looks count as
  "familiar", not discovery.

At each slot it takes the best-scoring look that breaks neither rule;
if none qualifies it relaxes discovery first, then variety. Nothing is
ever dropped, only moved. The rules carry across the seam when the next
page is added at the bottom.

## Step 4 — All Campus uses it (done, autopilot run 16)

`mobile/src/hooks/useForYouOrder.ts` ranks the pages the feed has
already loaded. **Following stays newest-first.**

- **Nothing jumps.** Once a look has a place it keeps it (`nextFeedOrder`).
  A like landing while she reads would otherwise reshuffle the card under
  her thumb. Brand-new uploads go on top as a group (where newest-first
  put them); each older page is ranked on its own and goes at the bottom
  as she scrolls. Pull to refresh works the whole order out again with
  her latest likes.
- **What it reads once per feed open:** her last 100 likes, who follows
  her (up to 500), and each tagged piece once (30 per read). Who she
  follows comes from the feed's existing live listener.
- **A look waits off-screen until its pieces are read**, so it lands in
  its proper place once. If a read fails it still appears, scored as if
  its pieces were unavailable.
- Her taste in occasions is learnt from the liked looks that are loaded
  in the feed — enough to tell "she likes Gameday", and free.

`scripts/explainFeed.ts` prints the same order, with a look's pure-score
place in brackets when the rules moved it.

### Known limits

- Ranking is within each loaded page of 20 newest looks, not across the
  whole campus — a great look from three days ago is not pulled up above
  this morning's page. At a few hundred looks that is the right trade
  (no server job, no extra reads). Revisit with the "when to revisit"
  note in `docs/decisions.md` (run 15).
