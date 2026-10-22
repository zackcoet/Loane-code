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

11. *(suggested)* An admin "Delete this account" button for privacy requests where she can't do it herself — reuses `deleteMyAccount`'s steps.

### D. The feed algorithm ("For You")
Goal: show each student what she's most likely to love **right now**, so the feed feels personal and fresh. Use the engagement events already tracked.
1. Make sure events are logged reliably: impressions, time spent on a post (dwell), likes, saves, comments, shares, tagged-piece taps, profile taps, follows, rental/purchase requests.
2. A ranking score per post combining: **who** (people she follows, mutuals, people she's interacted with), **what** (occasions, sizes, styles, and categories she engages with), **fresh** (newer posts boosted, decays over time), **quality** (engagement rate, not just raw likes), **available** (tagged pieces that are actually rentable for her dates rank higher).
3. Diversity rules: no more than 2 posts in a row from the same person; mix in a few discovery posts from people she doesn't follow.
4. "All Campus" uses the ranked feed; "Following" stays newest-first.
5. Explore/Discover grid ranked the same way, plus "Trending at USC this week."
6. Keep it **explainable and tunable**: weights in one config file, documented in `docs/feed-algorithm.md`, with a small script that prints why a post ranked where it did.
7. **Healthy engagement only:** no fake notifications, no guilt/streak pressure, no hiding the end of the feed with filler. Show "You're all caught up" when she's seen everything new from people she follows.

### E. Instagram-level polish
1. Pull-to-refresh and smooth infinite scroll everywhere lists exist.
2. Skeleton loaders (no blank screens), branded Loane loader for full-screen waits.
3. Double-tap to like with a heart animation; long-press preview on grid items.
4. Comment threads: reply to a comment, like comments, @mention autocomplete.
5. Profile: grid of looks, closet tab, follower/following lists, edit profile polish.
6. Search: people, pieces, and occasions with recent searches.
7. Notifications/Activity: grouped ("Ella and 4 others liked your look"), tappable to the right place, mark all read.
8. Empty states with a clear next action on every screen.
9. Haptics on key taps (like, follow, send).

### F. Onboarding (from the founder's improvement list)
1. Rent / lend / both step.
2. "What's coming up?" occasions step (feeds the algorithm).
3. Optional size step + "My size" filter in Discover.
4. "Follow 3 closets" step.
5. Welcome screen social proof (hidden under 50 users).
6. Invite-your-roommates share step.
7. Non-USC email → friendly waitlist screen (saved, visible in admin).
8. Onboarding steps tracked in the admin funnel.
9. Walkthrough tour max 3 steps.

### G. App Store readiness
✅ 1. Account deletion (see B4).
2. Every screen works with large text sizes and VoiceOver labels on buttons.
3. No crashes on: no internet, slow internet, empty data, deleted posts/users.
4. Privacy: list every type of data collected in `docs/app-store-privacy.md` (for the App Store privacy form).
5. Remove any dev-only text, test buttons, or placeholder copy from user-facing screens.

### H. Quality
1. Add tests for every new backend function and rules change.
2. Fix lint warnings and any `TODO` that's under an hour of work.
3. Performance: images sized properly, lists virtualized, no needless re-renders.
✅ 4. *(suggested — solved by C3: GitHub now runs the emulator tests on every push)* Let the overnight runner start the emulators: it can't download the Firestore emulator (Google's download site is blocked from the cloud runner), so rules and booking tests only run on Zack's laptop or in CI (see C3).

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
