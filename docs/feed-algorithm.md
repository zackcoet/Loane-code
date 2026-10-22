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
