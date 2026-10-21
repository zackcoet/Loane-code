# Server-side audit — every write the app makes on its own

Backlog item C1. The rule (CLAUDE.md): **never trust the phone.** This is
the list of every place the mobile app writes to Firestore or Storage
directly rather than through a Cloud Function, what the security rules
hold it to, and whether it should move to the server.

First written 2026-10-21 (autopilot run 6). Re-check whenever a new
`setDoc` / `updateDoc` / `addDoc` / `writeBatch` / `uploadBytes` appears:

```bash
grep -rnE "\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch|runTransaction|uploadBytes)\(" mobile/src mobile/app
```

## Already server-only (the app cannot write these at all)

Follows, likes and saves (posts and pieces), comments, posts (create and
delete), shared looks and pieces in chats, bookings and purchases,
reviews, reports, support requests, blocks, account creation and
deletion, usernames, every counter, `isVerified` / `role` / `status`,
listing removal, try-on generation, legal acceptance. The rules say
`allow write: if false` (or only allow the specific safe fields) for each.

## Direct writes that remain

| # | What | Where in the app | What the rules hold it to | Verdict |
|---|---|---|---|---|
| 1 | Send a message | `useMessaging.ts` send | Only in her own threads, sender = her, not blocked either way, must tick her hourly quota (500/h) in the same batch, no forged shared cards, a quoted reply must match the real message | **OK as is.** Rate-limited (A7), blocking enforced (B2), filter runs in `onMessageCreated`. |
| 2 | Mark a chat read / "Seen" | `useMessaging.ts` markRead | Only her own `unreadCounts` / `lastReadAt` keys, server clock only | OK — touches only her own view. |
| 3 | Hide or mute a chat | `useMessaging.ts` | Only her own `hiddenAt` / `mutedUids` entry | OK. |
| 4 | Heart a message | `useMessaging.ts` setLiked | Only adds/removes herself, max 2, not on a taken-down message, not if blocked | OK. Spam is capped: `onMessageLiked` counts a run of hearts once. |
| 5 | Create / edit a listing | `useListingForm.ts` | Owner = her, her campus, counters start at zero, price and photo checks mirror `validateListingDraft`, can't write counters / `bookedDates` / owner / campus, and (fixed in run 6) **can't edit a listing that is suspended, removed or sold** | OK after the run-6 fix. *Gap:* no rate limit on creating listings. *Gap:* name/description aren't run through the word filter. |
| 6 | Edit a post's caption / occasions | `edit-post.tsx` | Only `caption` (≤1000) and `occasions` (≤8) | OK. The filter re-checks edited captions (`flagEditedCaption`). |
| 7 | Edit her profile | `edit-profile.tsx`, `useProfilePhoto.ts` | Only her own doc, only name / bio / photo / sizes / showSizes / push tokens | OK. *Gap:* bio isn't run through the word filter, and the rules don't cap bio/name length. |
| 8 | Her private settings | `useUserSettings.ts` | Only her own doc; never her school email | OK. |
| 9 | Mute someone | `useMuted.ts` | Only her own `muted` list | OK — changes only what she sees. |
| 10 | Dismiss a suggested closet | `useSuggestedClosets.ts` | Only her own list | OK. |
| 11 | Mark an alert read | `useNotifications.ts` | Only her own alerts, only `readAt` | OK. |
| 12 | Try-on save / delete | `useTryOn.ts` | Her own try-ons only | OK, and try-on is switched off for v1. |
| 13 | Analytics events | `analytics/events.ts` | Allowed event types and surfaces only, `uid` = her | *Gap:* no rate limit — a script could pad the numbers we use to answer the MVP questions. Low risk while the campus is small. |
| 14 | Photo uploads | `lib/photo.ts` | `storage.rules`: only into her own folders, images only, size-capped (see `storage.rules.test.ts`) | OK. Server-side resizing is C4. |

## What to do next (in priority order)

1. **Word filter on listing text and bio** — same `queueAutoFlag` used for
   captions, from a trigger on listing/user updates. Small.
2. **Cap bio and display-name length in the rules** — they're unbounded today.
3. **Rate-limit listing creation** — e.g. a quota doc like `messageQuotas`.
4. **Rate-limit events** — only matters once the numbers are relied on for a
   decision; the simplest version is a per-hour quota doc.

None of these let one student touch another student's data, a counter, money
or trust — which is why they are listed as gaps rather than moved tonight.
