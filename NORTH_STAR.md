# NORTH STAR — Loane Autopilot

> Read this file in full at the start of every autonomous run. It is the single source of truth for what to build, what never to touch, and how to report. When this file and an older doc disagree, this file wins.

---

## 1. The goal

Loane is a student-only social fashion app at the University of South Carolina: **Instagram for borrowing and buying clothes from girls on your campus.** Students post outfits ("looks"), tag the pieces they own, and other students **Loane It** (rent) or **Own It** (buy).

**North Star:** a polished, App-Store-ready app that feels as smooth and habit-forming as Instagram — where a student opens it to see what her campus is wearing, finds something for this weekend, and comes back tomorrow.

Every run should move the app measurably closer to that. Prefer **finishing and polishing** over starting new half-features.

---

## 2. Hard rules — never break these

1. **Never deploy.** No `firebase deploy`, no `eas build`, no `eas submit`, nothing that touches the live Firebase project `loane-code`, App Store Connect, or joinloane.com. Everything runs against the local emulators (`demo-loane`).
2. **Never touch secrets.** Don't read, print, create, change, or commit `.env`, `.env.*`, keys, or passwords. Never set Firebase secrets.
3. **Never spend money.** No calls to paid APIs (FASHN, Anthropic, Resend, Stripe live). Features that need them stay switched off.
4. **Never turn these back on:** AI Try-On (off until v2), email verification/OTP (paused), Stripe payments (waiting on company setup). Don't delete their code either.
5. **Work only on the `autopilot` branch.** Never commit to or force-push `main`. Pull/rebase `autopilot` from `main` at the start of each run so it includes the founder's latest work.
6. **Every commit must pass checks:** `npm run typecheck`, `npm run lint`, and all tests. If you can't get them green, revert your change rather than commit broken code.
7. **Small commits.** One feature or fix per commit, with a clear plain-English message.
8. **Don't change these without a note in the log asking first:** brand colors/fonts, the 80/20 fee model, the Loane wording, legal text (Terms/Privacy), anything about how money works.
9. **Don't delete user-facing features** the founder built, even if they look unused. Hide behind a flag at most, and log it.
10. **Seed data stays fake.** Never add real people's names, photos, or contact details.
11. **This file overrides `CLAUDE.md` on one point:** `CLAUDE.md` says to show Zack a plan and wait for his OK. On autopilot runs, don't wait. Write the plan in the log entry, then build. Everything else in `CLAUDE.md` (never trust the phone, tokens, cents, dates, tests) still applies fully.

---

## 3. Brand rules (keep everything consistent)

- **Colors:** Cream `#F6EFE4` (background accent only), Merlot `#5E1A2E` (shared actions, headings), Cherry `#C8213F` (renter/buyer actions, + button, unread dots), Butter `#F7DC7A` (lender actions), Ballet `#EFAFC2`, Denim `#7F95B0`, Ink `#231619` (body text). Mostly white space. Midnight is marketing-only, never in the app.
- **Color roles:** Butter = lender, Cherry = renter/buyer, Merlot = both.
- **Fonts:** Figtree everywhere; DM Serif Display for big moments. Every text style needs a `fontFamily` (lint enforces it).
- **Words:** Loane It (rent), Own It (buy), Put it on Loane (list), On Loane (currently rented), Become the owner (buy CTA). Buttons use these exactly; sentences stay natural English.
- **Tokens only.** No raw hex codes outside `tokens.ts`.
- **Tab bar:** never set height or padding on it. React Navigation sizes it. (See the comment at the top of the tabs layout — it's been broken four times by guessing numbers.)

---

## 4. The backlog — work top to bottom

Pick the **highest unfinished item**. Finish it fully (UI, backend, rules, tests, empty/loading/error states) before moving on. If an item is blocked, log why and skip to the next.

### A. Messaging (make DMs feel like Instagram)
✅ 1. Reply to a specific message (swipe to reply, quoted preview).
✅ 2. Share a post or listing into a DM from anywhere (share sheet → pick people → sends as a rich card that opens the post/listing).
✅ 3. Send photos in DMs. *(was already built before autopilot started — the + in the chat composer)*
✅ 4. Read receipts ("Seen") and unread counts that stay accurate.
✅ 5. Message reactions (double-tap heart).
✅ 6. Inbox polish: search conversations, swipe to delete/mute, pinned "requests" from people you don't follow.
✅ 7. **Rate-limit message sends** (move sending behind a Cloud Function or equivalent) — currently unlimited.
✅ 8. *(suggested)* A setting to turn read receipts off, like Instagram's "Show read receipts".
✅ 9. *(suggested)* When someone hearts your message, update the inbox preview ("Liked a message") and count it as unread.

### B. Safety (Apple requires this for apps with user content — guideline 1.2)
✅ 1. Report flow everywhere: posts, listings, comments, profiles, messages — with reasons and an optional note; lands in the admin Reports queue.
✅ 2. Block works everywhere: blocked users disappear from feed, search, suggestions, comments, DMs, and can't message you.
✅ 3. Hide/mute a user without blocking.
✅ 4. **Delete my account** in Settings (Apple requires in-app account deletion): deletes or anonymizes the user's data, with a confirm step.
✅ 5. Basic objectionable-content filter on captions, comments, and messages (word list), with admin review.
✅ 6. Admin: one-click actions on reports (hide content, warn, suspend), with an audit log.

✅ 7. *(suggested)* Let an admin take down a reported review or message straight from the report (today: warn or suspend her; reviews need the rating recalculated).
8. *(suggested)* Add Venmo / Cash App / Zelle to the word filter once payments run inside the app.

### C. Production foundations (build it like a real company's app)
Follow `CLAUDE.md`'s rule: **never trust the phone.** Anything involving money, bookings, trust, counts, or other people goes through a Cloud Function, never a direct write from the app.
✅ 1. **Audit every direct write the app makes** to Firestore/Storage. List them in `docs/server-side-audit.md`. Anything that touches another user, a counter, trust, or could be spammed moves behind a Cloud Function (messages, comments, likes, saves, follows, reports). Security rules then forbid the direct write. Tests for each. *(Audit written in run 6: `docs/server-side-audit.md`. Four small gaps left — see its "What to do next". Run 7 closed two: the word filter now checks piece names/descriptions and bios, and bio/name length is capped. Run 8 added the new-piece limit (60 an hour); the activity-tracking limit is deliberately left for App Check — see `docs/security-rules-review.md`.)*
✅ 2. **Security rules review:** every collection has a test proving a student can't read or write what she shouldn't (other people's private settings, DMs she's not in, admin data). *(Done in run 8 — the map is `docs/security-rules-review.md`.)*
✅ 3. **Automatic checks on GitHub (CI):** a GitHub Actions workflow that runs typecheck, lint, and tests (with emulators) on every push and pull request, so broken code is caught even when nobody's watching.
✅ 4. **Image pipeline:** resize and compress uploads server-side into thumbnail + full sizes; lists load thumbnails only. *(Done in run 9: a 480px copy of every listing and look photo; grids fall back to the full photo until it's ready. Why it works this way: `docs/decisions.md`.)*
✅ 5. **Pagination everywhere** (feed, comments, messages, followers, search) with the matching Firestore indexes in `firestore.indexes.json`. Add a script that checks every query has its index, because the emulator doesn't enforce indexes and production does. *(Run 9 checked every query by hand against the index file: none missing. Run 10 added the script — `npm run check:indexes`, also part of `npm test` and GitHub's checks — and paging for chats, comments and follower lists; the feed and profile grids already paged. Run 11 finished it: people search now fetches one capped page. Discover's piece search deliberately stays on the phone (up to 1,000 pieces) per `docs/roadmap.md` — moving it to a paid search service at ~1,500 pieces on one campus is a NEEDS ZACK decision for later.)*
✅ 6. **Error handling:** every Cloud Function returns friendly, specific errors; every screen shows a retry instead of a blank or a crash. Functions log structured errors so problems are findable later. *(Run 11 started it: Discover, people search, Activity, rentals, a rental, a piece's page, Messages and Message requests now show "Couldn't load … Try again" instead of a false empty. Run 12 finished it: saved, liked, reviews, profile grids, My Listings, a profile, a look, a chat, Help and the feed (one failed page no longer wipes it); every Cloud Function now goes through one safety net that gives a friendly message and writes one findable log line with a code she also sees — see `docs/decisions.md`.)*
✅ 7. **Crash and error reporting:** prepare the code for a crash reporter (e.g. Sentry) but leave it switched off. Signing up for one is **NEEDS ZACK**. *(Run 12: `mobile/src/monitoring/crashReporter.ts`, off; a crashed screen shows "Something went wrong" with Try again.)*
✅ 8. **Feature flags:** one config document controls risky or unfinished features (try-on, OTP, same-day, payments) so they can be switched without a new app build. *(Run 13: `config/features`, one panel in the dashboard. Nothing changed state; email codes and payments are locked off until their setup exists.)*
✅ 9. **Data export and deletion:** a Cloud Function that exports or deletes everything about one user (needed for account deletion and privacy requests). *(Run 13: export is built — Settings → Download my data, and Export her data in the dashboard. Deletion was already "Delete my account" (B4). An admin-side delete is left as a suggestion below.)*
✅ 10. **Backups and monitoring for the live project:** write the setup steps in `docs/production-ops.md` (scheduled Firestore backups, budget alerts, error alerts). Don't run them; that's **NEEDS ZACK**. *(Run 12 wrote it; nothing switched on.)*

✅ 11. *(suggested)* An admin "Delete this account" button for privacy requests where she can't do it herself — reuses `deleteMyAccount`'s steps. *(Run 25: built — Users → a student → Delete this account. Type her @username to confirm; audited.)*

### D. The feed algorithm ("For You")
Goal: show each student what she's most likely to love **right now**, so the feed feels personal and fresh. Use the engagement events already tracked.
✅ 1. Make sure events are logged reliably: impressions, time spent on a post (dwell), likes, saves, comments, shares, tagged-piece taps, profile taps, follows, rental/purchase requests. *(Run 14: feed impressions with time-on-screen added, and the follows that were never recorded. The full list of what's recorded is in `docs/feed-algorithm.md`.)*
✅ 2. A ranking score per post combining: **who** (people she follows, mutuals, people she's interacted with), **what** (occasions, sizes, styles, and categories she engages with), **fresh** (newer posts boosted, decays over time), **quality** (engagement rate, not just raw likes), **available** (tagged pieces that are actually rentable for her dates rank higher). *(Run 15: `shared/src/feedRanking.ts`, 19 tests. Runs on her phone; only server-written counts and locked listings can lift a look on someone else's feed. "Available" means free some day in the next 7, since the feed has no dates of hers. The weights and the "why did it rank there" script are already in — D6 only needs tidying when D4 wires it in.)*
✅ 3. Diversity rules: no more than 2 posts in a row from the same person; mix in a few discovery posts from people she doesn't follow. *(Run 16: `shared/src/feedOrder.ts` — max 2 in a row, and 1 in every 4 from someone she doesn't follow while any are left; looks are moved, never dropped.)*
✅ 4. "All Campus" uses the ranked feed; "Following" stays newest-first. *(Run 16: `useForYouOrder`. A look keeps its place once shown; new uploads go on top, each older page is ranked and added below; pull to refresh re-ranks. Ranking is within each loaded page — see `docs/feed-algorithm.md`.)*
✅ 5. Explore/Discover grid ranked the same way, plus "Trending at USC this week." *(Run 16: the grid — Discover opens on a "For you" sort. Run 17: Trending — an hourly server job (`refreshTrending`) counts the week's saves, requests and tag taps per piece, once per person, owner excluded; a row at the top of Discover. See `docs/decisions.md`.)*
✅ 6. Keep it **explainable and tunable**: weights in one config file, documented in `docs/feed-algorithm.md`, with a small script that prints why a post ranked where it did. *(Run 17: every dial — feed, Discover, variety, trending, caught-up — is in `FEED_RANKING`; `explainFeed.ts --discover` covers Discover and Trending.)*
✅ 7. **Healthy engagement only:** no fake notifications, no guilt/streak pressure, no hiding the end of the feed with filler. Show "You're all caught up" when she's seen everything new from people she follows. *(Run 17: a marker in Following after the last look from the past 3 days, then "Older looks". No streaks or fake notifications found.)*

✅ 8. *(suggested)* Count taps on the Trending row (a `surface` for it) so we can see whether trending pieces get rented more. *(Run 18: done as a tag, `meta.from: 'trending'`, on the piece's view and on any request made from it — see `docs/feed-algorithm.md`.)*

### E. Instagram-level polish
✅ 1. Pull-to-refresh and smooth infinite scroll everywhere lists exist. *(Run 18: Discover, Activity, both profiles, Messages, requests, My Listings, My Rentals, Rental requests, Saved, Liked, Reviews. Run 19: comments, followers/following and who-liked; who-liked now pages (was cut off at 200) and Activity → Updates pages (was cut off at 50). Left as they are on purpose: the inbox keeps its latest 50 chats and bookings load whole, because the unread badge and the "Needs you" counts read the same list — see `docs/decisions.md`.)*
✅ 2. Skeleton loaders (no blank screens), branded Loane loader for full-screen waits. *(Run 19: `Skeleton.tsx` — grey rows on Messages, requests, Activity, comments, followers, who-liked, My Rentals, Rental requests; a grid on Liked. Run 20 finished it: Discover, both profiles, My Listings, Saved, Reviews, Recently Rented, a look, a piece and a chat. The feed keeps the branded Loane loader.)*
✅ 3. Double-tap to like with a heart animation; long-press preview on grid items. *(Double-tap heart was already built. Run 20: press and hold a tile on a profile's Closet/Posts grid or the Liked/Saved looks grid → a big preview card; tap it to open, tap outside to close — see `docs/decisions.md`.)*
✅ 4. Comment threads: reply to a comment, like comments, @mention autocomplete. *(Run 21: replies were already built — fixed Reply on a reply, which the server refused. Added hearts on comments (server-side, own collection), @mention suggestions while typing, tappable @names, and alerts for replies, mentions and hearts — one alert per person. See `docs/decisions.md`.)*
✅ 5. Profile: grid of looks, closet tab, follower/following lists, edit profile polish. *(Grid, closet tab and follower lists were already built. Run 21: "Discard changes?" when leaving Edit Profile, Edit Look or Edit Listing with unsaved edits.)*
✅ 6. Search: people, pieces, and occasions with recent searches. *(Run 21: on Discover — recent searches (on her phone only, up to 10, removable), matching students and occasions as she types, above the pieces.)*
✅ 7. Notifications/Activity: grouped ("Ella and 4 others liked your look"), tappable to the right place, mark all read. *(Run 21: likes on one look, comment hearts on one look, and new followers group; rental alerts never do. Every alert now opens its look, comments, profile or rental. Grouping covers the updates already loaded.)*
✅ 8. Empty states with a clear next action on every screen. *(Run 21: "not found" screens, empty Activity updates and an empty inbox now offer a next step. Lists where the next step is already on screen — comments, a new chat — or that are just information — blocked, muted, reviews — were left as they are.)*
✅ 9. Haptics on key taps (like, follow, send). *(Run 21: like, save, comment heart, follow, sending a message or comment.)*
✅ 10. *(suggested)* Page the Messages inbox past 50 chats — needs the unread badge to stop reading the same list first. *(Run 26: the inbox loads 50 more as she scrolls; the badge keeps its own window of her 50 most recent chats — see `docs/decisions.md`.)*
✅ 11. *(suggested)* Press-and-hold preview on Discover's piece grid too, and count previews as their own event (needs a new event type in the database rules, so do it on a run where the rules tests can run). *(Run 27: hold a piece on Discover → the same preview card as profiles. Every preview, anywhere, logs `grid_preview` — recorded only; the ranking doesn't read it.)*
✅ 12. *(suggested)* Count comment hearts as an event (`comment_like`) — needs a new event type in the database rules, same as 11. *(Run 27: `comment_like` / `comment_unlike`, logged after the server accepts the heart.)*
✅ 13. *(suggested)* "Share profile" — send a closet into a DM like a look (needs a new message card type and a rules change). *(Run 27: "…" on a profile → Share profile; ☰ → Share My Profile. Card stamped by a new server function, `shareProfile`; the rules refuse a phone-written one. See `docs/decisions.md`.)*
✅ 14. *(suggested)* "Discard changes?" on the new-look and new-piece flows too (only the edit screens have it). *(Run 25: "Discard this look?" on Arrange, "Discard this piece?" on Add to Closet and Quick add.)*
✅ 15. *(suggested)* A shared profile card opens by @username, so it breaks if she later renames herself. Open it by account id instead (needs a small "profile by id" route). *(Run 28: the card now opens her by account id, with the @username only as a fallback. No new route needed — the profile screen takes the id alongside the handle.)*

### F. Onboarding (from the founder's improvement list)
✅ 1. Rent / lend / both step. *(Run 22: `app/get-started.tsx`, straight after Create account, new accounts only. Every step skippable.)*
✅ 2. "What's coming up?" occasions step (feeds the algorithm). *(Run 22: each pick counts as 3 liked looks in For You and Discover — see `docs/feed-algorithm.md`.)*
✅ 3. Optional size step + "My size" filter in Discover. *(Run 22: sizes go to her profile, still hidden unless she turns them on; "My size" in Discover's Filter hides a piece only when both sizes are known and differ.)*
✅ 4. "Follow 3 closets" step. *(Run 22: friends-of-friends first, then the most-followed at USC.)*
✅ 5. Welcome screen social proof (hidden under 50 users). *(Run 22: "Join 120+ girls at USC", rounded down. Deleting an account now lowers the count.)*
✅ 6. Invite-your-roommates share step. *(Run 22: last step of Get started, same message as Invite Friends.)*
7. Non-USC email → friendly waitlist screen (saved, visible in admin). *(Run 22: NOT built — today ANY .edu email can sign up and gets its own school made on the fly, which was set up on 2026-10-12. A waitlist means turning those students away. Waiting on Zack — see the log.)*
✅ 8. Onboarding steps tracked in the admin funnel. *(Run 22: Overview → Get Started Funnel.)*
✅ 9. Walkthrough tour max 3 steps. *(Run 22: feed, the +, Activity.)*
✅ 10. *(suggested)* A "My size" quick chip on Discover's top row, next to the occasions, so it is one tap instead of inside Filter. *(Run 25: first chip in the row, shown once she has a size on her profile.)*
✅ 11. *(suggested)* Count signups on other schools' .edu addresses in the dashboard, to see demand for the next campus (pairs with F7). *(Run 28: Campuses → "Sign-ups from other schools", most first, from the server-kept student counts.)*

### G. App Store readiness
✅ 1. Account deletion (see B4).
✅ 2. Every screen works with large text sizes and VoiceOver labels on buttons. *(Run 23: text follows the iPhone's Text Size up to 1.5x — every fixed-size piece checked to fit; switches, text boxes and headings now speak properly in VoiceOver. Every tappable thing already had a name or its own words — checked with a script. See `docs/decisions.md`.)*
✅ 3. No crashes on: no internet, slow internet, empty data, deleted posts/users. *(Run 24: a "No internet connection" bar; saves, uploads and messages say "no internet" at once and keep what she typed instead of spinning; an offline launch no longer sends her to create an account; looks, pieces, rentals, Messages, Activity, the feed and comments say "Couldn't load" offline instead of "not found"/"nothing yet". Photo uploads give up after 1 minute on a bad signal (was 10). Deleted posts and accounts were already handled by earlier runs ("not found" screens, "Deleted account" shells). See `docs/decisions.md`.)*
✅ 4. Privacy: list every type of data collected in `docs/app-store-privacy.md` (for the App Store privacy form). *(Run 23: written from the code. No tracking, no ads, no outside analytics. Filling in Apple's form is Zack's.)*
✅ 5. Remove any dev-only text, test buttons, or placeholder copy from user-facing screens. *(Run 23: swept every screen — none found. "Payments are coming soon" on Payouts is deliberate while payments are off; Try-On's "soon" only shows if Try-On is switched on.)*

✅ 6. *(suggested)* A lint check that fails when a screen uses React Native's own `Text` without the text-size cap, so new screens can't miss it. *(Run 26: `scripts/check-text-cap.mjs`, part of `npm run lint`.)*
✅ 7. *(suggested)* The same offline rule for the remaining live lists (followers, saved, liked, reviews, help requests) — run 24 covered the main ones. *(Run 26: done.)*
8. *(suggested)* Test the offline behaviour on a real phone: Airplane Mode → open Loane, open a chat and send, open a look. Overnight runs can't run the phone.

### H. Quality
1. Add tests for every new backend function and rules change. *(Ongoing sweep. Run 30: tests for the rate limiter and for writing/editing reviews — and two bugs they turned up, fixed: sign-ups on shared campus wifi, and star averages drifting. Run 31: tests for following, likes, saves and changing a username — four small bugs fixed. Run 32: comments, comment hearts and saying yes to a rental or sale — three bugs fixed, the biggest being a piece that could be sold twice. Run 33: the hourly rental clock — it could undo a yes or a complaint that landed at the same moment; fixed, with tests. Run 34: contact matching and suggested closets — a girl who blocked you could still turn up in contacts, contact checks were unlimited, and suggestions could come from other schools; fixed, with tests. Run 35: starting chats, removing a piece and Contact us — no new chats with deleted/suspended accounts, chat context checked, a removal/request clash closed, and Contact us capped at ten a day; with tests Run 36: sharing a look, piece or profile into chats, and closing Contact us messages in the dashboard — a share could put a girl's closet in front of someone she'd blocked; fixed, with tests. Run 37: the dashboard's take-down, suspend and dispute buttons — "put it back" could make a sold piece buyable again, a deleted account could be revived, and two clicks could count a rental twice; fixed, with tests. Run 38: posting, deleting and scheduling a look — a look's photo could be any link on the internet, a double-tap delete counted down twice, and the scheduler could miss due looks or bring a deleted one back; fixed, with tests. Run 41: reporting and blocking — a report trusted the phone about who it was about (the dashboard's suspend acts on that), chat reports had no student attached, and a double-tap Block counted follows down twice; fixed, with tests Run 42: editing a look, blocked dates on a piece, and rental hand-over photos — a taken-down look could be rewritten before being put back, blocked dates could trap a lender, and hand-over "photos" could be any picture on the internet; fixed, with tests. Run 43: the steps after a yes — drop-off, "I have it", return, flagging a problem, cancelling — and buying a piece. A sale went on to "return it" like a rental and only became sold after a return; now it ends at "I have it". A sale's saved record was missing parts, which made the seller's drop-off fail without a note; fixed, with tests. Run 44: the hourly rental reminders — "Drop off today" and "Due back today" went out at 8 PM the night before (the server's clock is a different time zone from Columbia); now they use Columbia's day, never go out between 9 PM and 8 AM, are sent once even if she hands it back at that moment, and none get skipped once Loane has lots of rentals; with tests. Run 46: the dashboard's dispute decision and signing up — deciding a dispute never asked for reviews and, on a sale, left the piece buyable; a finished sale could put a taken-down piece back up; a girl on a school's second address (g.clemson.edu) got a campus of her own; junk sign-up input crashed; and sign-up never added new girls to her campus's student count. Fixed, with the first sign-up tests. Run 47: the background jobs that copy a girl's new name and photo onto her looks, pieces, comments and chats, and the view and tagged-piece-tap counters — an old name could win over a new one, a new photo bumped every chat to the top of the inbox, one deleted look could stop the rest being updated, and a tap could credit a look that never tagged the piece. Fixed, with tests. Run 48: the jobs behind the inbox preview, the tag labels on looks and a piece's greyed-out calendar — an older message could show in the inbox over a newer one, an old price could win back onto tags, a freed weekend could stay greyed out, and a tampered phone could date a message next year. Fixed, with tests. Run 49: the jobs that run edited captions, piece text and bios past the word filter, and the one behind "Find friends from contacts" — typing another girl's number into your settings let you be found instead of her, removing it made her vanish too, and quick edits could leave an old number matching. Sign-up names and new @usernames were never checked by the word filter. Fixed, with tests. Run 50: the "is this username free?" check and the share helpers — junk crashed the username check; and opening a chat, reading it, or an admin take-down floated the chat to the top of both girls' inboxes. Fixed, with tests. Run 51: publishing and accepting Terms/Privacy, and private admin notes — two admins publishing at once could put two new Terms live back to back, a made-up effective date was accepted, and a deleted account could be stamped as agreeing. Fixed, with tests. Run 52: re-read the dashboard's take-down buttons against account deletion — a comment an admin had hidden survived its author deleting her account, and "put it back" could bring a deleted girl's words back; hiding a comment could take a look's count below zero. Fixed, with tests Run 53: re-read reviews and reports against account deletion — a deleted girl's name and photo stayed on the other girl's past rentals (the Privacy Policy promises they don't), a review could still be written about her (sending an alert into her erased inbox), and her empty profile could still be reported. Fixed, with tests. Run 54: re-read "Download my data" against deletion and blocking — the file showed whether the other girl in a chat had read your messages (even with read receipts off), muted the chat or deleted it. Now it only shows your own side. Fixed, with tests. Run 55: re-read muting and hiding a user (B3) against deletion and blocking — the Blocked and Muted lists showed deleted accounts you could never unblock, and said "Nobody blocked" on a bad signal (making a block look undone). Fixed. App-only, nothing to deploy Run 56: re-read suggested closets and contacts against muting, and the alerts left behind by a deleted account — a girl you'd muted was still suggested to follow, and other girls' Activity kept naming a deleted girl for up to a month. Fixed, with tests. Run 57: re-read the profile screen and chats against renames and deletion — tapping a name on a review, comment, look, piece or chat opened her by @username only, so after she renamed herself it said "Closet not found" or opened whoever took her old name; now every tap opens her by account id. A chat with a deleted account no longer offers Report-or-block or a Reply with nowhere to type. App-only, with a test. Run 58: re-read rentals and alerts against renames — after a rename, a rental still going showed her old @name (the chat beside it showed the new one), and reviews she wrote kept her old @name forever, even once someone else took it. Both now follow her new name; finished rentals keep the name they had. Server fix, with tests.)*
✅ 2. Fix lint warnings and any `TODO` that's under an hour of work. *(Run 50: no lint warnings. Every TODO left waits on payments (Phase 5), real email checks before beta, or circles/instant book (later phases) — none is an hour's tidy-up.)*
✅ 3. Performance: images sized properly, lists virtualized, no needless re-renders. *(Run 24 started: the rental page's small piece photo now loads the thumbnail. Every long list already uses a scrolling list that only draws what's on screen; the shared-look/piece cards in chats stay full-size on purpose — a 480px thumbnail looks soft at that size. Run 29 finished it: every small photo checked — all use thumbnails where one exists. The feed, Discover's grid and chats now only re-draw the cards that actually changed: before, one letter typed in a chat re-drew the whole thread, and one like on campus re-drew every feed card. See `docs/decisions.md`.)*
✅ 4. *(suggested — solved by C3: GitHub now runs the emulator tests on every push)* Let the overnight runner start the emulators: it can't download the Firestore emulator (Google's download site is blocked from the cloud runner), so rules and booking tests only run on Zack's laptop or in CI (see C3).
5. *(suggested)* Feel-check run 29's speed-up on a real phone: scroll the feed, type fast in a long chat. Overnight runs can't hold a phone.
✅ 6. *(suggested)* When a piece is sold, automatically say no to the other girls still waiting on a request for it, instead of leaving them to time out. Today the lender just can't accept them any more. *(Run 33: the moment she says yes to a buyer, every other open request for the piece — rentals too — is answered "Sold to someone else" and each girl gets an alert. A new rental request on a piece she's agreed to sell is refused up front. If that sale later falls through, those girls would have to ask again — rare, and noted in `docs/decisions.md`.)*

✅ 7. *(suggested)* Check that a piece's photos and a profile photo are her own uploads to Loane, the way looks now are (run 38). Pieces and profiles are saved straight from the phone, so this is a database-rules change plus tests. *(Run 39: profile photo done. Pieces NOT done — the database rules ran out of steps on a piece with 8 photos, so this needs saving a piece to move into a Cloud Function first, like looks. That is a bigger job: the app's Add to Closet and Edit Listing save would call it instead of writing directly.)*
✅ 8. *(suggested)* Stamp the little copy of her name and photo on each new piece (`owner`) on the server, the way looks are. Today the phone writes it and nothing checks it matches her profile, so a tampered app could show a piece under someone else's name. *(Run 40: done in `writeListing` — copied from her profile on every save, new or edited.)*
✅ 9. *(suggested)* The rest of the app still works out "today" on the world clock (UTC), which turns over at 8 PM in Columbia: after 8 PM the calendar greys out today and a same-day request counts as tomorrow's. Make the phone and the request checks use Columbia's day too (`campusClock`, added in run 44). Touches booking dates, so do it carefully with tests. *(Run 45: done — `campusToday()` everywhere a rental date is compared with today, phone and server. Found on the way: a request for today or tomorrow expired within the hour, before the lender could answer; fixed. See `docs/decisions.md`.)*
10. *(suggested)* A suspended girl's profile still opens normally, with Follow and Message buttons the server then refuses ("not available"). Decide what other girls should see — Instagram shows a suspended account as "not found". Touches moderation, so check with Zack first.

---

## 5. How each run works

1. `git checkout autopilot && git pull` then merge/rebase latest `main`. Install deps if needed.
2. Read this file, then `docs/autopilot-log.md` (what previous runs did), `docs/decisions.md`, and `CLAUDE.md`.
3. Run `npm run build:shared && npm run build:functions` first (the root `npm run emulators` does **not** build functions, so skipping this runs stale code), then start the emulators and `npm run seed`.
4. Pick the next backlog item. Write a 3–5 line plan at the top of your log entry before coding.
5. Build it fully. Run typecheck, lint, tests. Commit. Repeat with the next item until the run ends.
6. Push the `autopilot` branch.
7. **Update `docs/autopilot-log.md`** (newest entry at the top) — see format below.
8. If something important is broken that you can't fix, stop, log it clearly at the top under **🚨 NEEDS ZACK**, and don't pile new work on top.

---

## 6. The log — `docs/autopilot-log.md`

The founder is not a coder. Write the log in **plain English, no jargon.** Each run adds an entry at the top:

```
## [date] — Run summary
**Built:** (bullets — what a student would notice)
**What to tap to see it:** (exact steps on the phone, e.g. "Messages → open a chat → swipe right on a message → Reply")
**Fixed:** (bugs, in plain words)
**Skipped / blocked:** (and why)
**🚨 NEEDS ZACK:** (decisions only he can make — or "Nothing")
**Next up:** (the next backlog item)
**Commits:** (short list)
```

Also mark items in Section 4 of this file with ✅ at the start of the line as they're fully done, and add new backlog ideas at the bottom of the right section marked *(suggested)* — never reorder the founder's priorities.

---

## 7. When in doubt

- Choose the **simplest** solution that fully works.
- Match how Instagram does it unless it conflicts with the brand rules or Loane's rental features.
- If a decision affects money, legal text, brand, or deleting things — **don't do it; log it under NEEDS ZACK.**
- Never claim something works without running the checks.
