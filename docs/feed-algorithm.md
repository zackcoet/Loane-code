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

## Step 5 — Discover, "For you" and Trending (done, autopilot runs 16–17)

Discover's grid of pieces now opens on a **For you** sort (Newest and the
price sorts are still in the sort menu). `shared/src/discoverRanking.ts`
scores each piece with the same five parts, tuned for a closet — weights
in `FEED_RANKING.discover`:

| Part | Weight | For a piece |
|---|---|---|
| who | 0.8 | Same as a look: she follows the owner, mutuals, liked her looks |
| what | 0.8 | The piece's occasions vs. the occasions of pieces she has **saved** (last 60 saves) |
| fresh | 0.6 | Halves every **week** — a piece stays relevant far longer than a post |
| quality | 0.8 | (saves × 2 + tags in looks × 1 + finished rentals × 4) per view, smoothed — server counters only |
| available | 1.0 | 1 if she can rent or buy it in the next 7 days, else 0 |

The grid only re-ranks when a piece is added or removed or she comes
back to Discover — never because a count moved while she browses. A
brand-new piece goes on top until then. Her side (likes, follows,
followers) comes from `useRankingViewer`, shared with the feed.

### Trending at USC this week (autopilot run 17)

A sideways row at the top of Discover, shown only while she is browsing
everything (no search, no filters, the Explore tab) and only when at
least 2 pieces qualify.

- **Worked out on the server, every hour** — `refreshTrending` in
  `backend/functions/src/listings/trending.ts`. It reads the last 7 days
  of three signals per campus and writes the top 10 to
  `trending/{campusId}`. Only Cloud Functions can write that document
  (rules + test), so nobody can put her own piece on the list.
- **The score** (`rankTrending`, `shared/src/trending.ts`, dials in
  `FEED_RANKING.trending`): per piece, **2 points per student who saved
  it, 4 per student who asked to rent or buy it, 1 per student who
  tapped it in a look**.
- **Hard to game:** each student counts once per piece per kind, however
  often she repeats it; the owner's own actions never count; a piece
  needs 2 different students before it can trend; saves and requests
  come from documents only the server writes, and tag taps (written by
  phones) count least.
- **The phone reads one small document** of ids and looks them up among
  the pieces Discover already loaded — so a blocked closet or a sold
  piece simply drops out, with no extra reads. If the read fails the row
  just doesn't show.
- The emulator never fires a scheduled job: the seed runs it once, and
  an admin can call `runTrendingRefresh`.
- Reads are capped at 5,000 newest rows per signal per campus per run; a
  warning is logged if a campus ever hits it.
- **Measuring the row itself** (autopilot run 18): a tap on a Trending
  card opens the piece with `from: 'trending'`, and that rides along as
  `meta.from` on its `listing_view` and on the `rental_requested` event
  if she asks to rent or buy it from there. Compare
  `rental_requested` rows with `meta.from == 'trending'` against
  `listing_view` rows with the same tag to see whether Trending turns
  into rentals. The allowed values are `LISTING_ENTRY_POINTS` in
  `shared/src/constants.ts`; anything else is dropped, not logged. The
  hourly score deliberately ignores views, so tapping the row cannot
  feed itself.

## Step 6 — Explainable and tunable (done, autopilot run 17)

- **Every dial is in one place:** `FEED_RANKING` in
  `shared/src/feedRanking.ts` — the feed's weights, Discover's, the
  variety rules and Trending's.
- **"Why is this here?"** for both screens (emulator only):

```bash
cd backend/functions
npx tsx scripts/explainFeed.ts --user ellapetrickcloset             # the feed
npx tsx scripts/explainFeed.ts --user ellapetrickcloset --discover  # Discover + Trending
```

## Step 7 — Healthy engagement (done, autopilot run 17)

- **"You're all caught up" on Following.** Following is newest first.
  Once she scrolls past every look from people she follows posted in the
  last 3 days (`FEED_RANKING.caughtUp.windowHours`), a marker says so —
  "You've seen every new look from the past 3 days" — and labels what
  follows as **Older looks**. Placed by `caughtUpIndex` in
  `shared/src/feedOrder.ts` (tested). It only appears when there are both
  new looks above and older ones below; otherwise the empty state or the
  end-of-feed "You're all caught up" line already says it.
- **The end is the end.** When there's nothing left to load, both tabs
  say "You're all caught up". Nothing is padded in to keep her scrolling.
- **No pressure mechanics.** Checked in run 17: no streaks, no
  "you'll lose…" copy, and every notification comes from something a real
  student did (they are written by Cloud Functions from real likes,
  follows, comments and bookings).
- All Campus is ranked, so "newer than here" means nothing there; it
  gets the end-of-feed line only.
