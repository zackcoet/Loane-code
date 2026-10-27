# Autopilot Log

Plain-English record of every autonomous run. Newest entry at the top. Rules and backlog live in [`NORTH_STAR.md`](../NORTH_STAR.md).

## 🚨 NEEDS ZACK
- From run 63 (only when you next deploy): a server fix so a deleted girl's taken-down pieces and looks can't be put back, and she can't be given free try-ons. Normal deploy, nothing to switch on, no new index.
- Nothing new from run 62 to deploy (dashboard only — it picks the change up next time it's built).
- Nothing new from run 61 to deploy (dashboard and app changes only). One small question: when an admin deletes an account, the audit log keeps her old @username on that one line (admins only see it). I left it — it's the record of who was deleted — but say if you'd rather it went too.
- From run 60 (only when you next deploy): a server fix so deleting an account takes her name off her Contact us messages. Normal deploy, nothing to switch on, no new index.
- Nothing new from run 59 (admin dashboard changes only — nothing to deploy to the server; the dashboard picks them up next time it's built).
- From run 58 (only when you next deploy): a server fix so a new @username reaches rentals still going and reviews she wrote. Normal deploy, nothing to switch on, no new index.
- Nothing new from run 57 (phone-app changes only — nothing to deploy).
- From run 56 (only when you next deploy): two server fixes and one new database index (deploy the index with them). Normal deploy, nothing to switch on.
- Nothing new from run 55 (phone-app changes only — nothing to deploy).
- From run 54 (only when you next deploy): a server fix to "Download my data". Normal deploy, nothing to switch on.
- From run 53 (only when you next deploy, and use the new app build after): server fixes to account deletion, reviews and reports. Normal deploy, nothing to switch on. Accounts deleted before this deploy keep their name on old rentals; say the word and a later run can write a one-time clean-up for those.
- From run 52 (only when you next deploy): server fixes to account deletion and the dashboard's comment take-down. Normal deploy, nothing to switch on.
- From run 51 (only when you next deploy): server fixes to publishing and accepting Terms/Privacy. Normal deploy, nothing to switch on. No legal wording changed.
- From run 50 (only when you next deploy, and use the new app build after): server fixes so chats only move in the inbox when someone writes. Normal deploy, nothing to switch on.
- From run 49 (only when you next deploy): server fixes to "Find friends from contacts" and to the word filter at sign-up. Normal deploy, nothing to switch on, nothing to recount.
- From run 48 (only when you next deploy): server fixes to the inbox preview, tag labels and booked dates, plus one small database rules change (a message's time is set by the server). The current app already works with it. Normal deploy, nothing to switch on.
- From run 47 (only when you next deploy): server fixes to how a new name or photo spreads across her looks and chats, and to the look view/tap counters. Normal deploy, nothing to switch on.
- **From run 46 — the student count on each campus is wrong on the live project.** Sign-up never actually added new girls to it (deleting an account did take them off), so "Join 120+ girls at USC" and the dashboard's Campuses page read too low, maybe below zero. After you next deploy, run the recount once: `cd backend/functions && npx tsx scripts/recountCampusStudents.ts --project loane-code` shows what it would change; add `--write` to save. Normal deploy otherwise, nothing to switch on.
- From run 45 (only when you next deploy, and use the new app build after): server fixes so rental dates go by Columbia's day, and so a request for today or tomorrow doesn't expire before the lender sees it. Normal deploy, nothing to switch on.
- From run 44 (only when you next deploy): a server fix to the hourly rental reminders, plus one new database index. Normal deploy, nothing to switch on.
- From run 43 (only when you next deploy, and use the new app build after): server fixes to buying a piece and the rental steps. Normal deploy, nothing to switch on.
- From run 42 (only when you next deploy): server fixes to blocking dates, rental hand-over photos and blocking someone, plus a small database rules change to editing a look. Normal deploy, nothing to switch on.
- From run 41 (only when you next deploy): server fixes to reporting, blocking and following. Normal deploy, nothing to switch on.
- **From run 40 (only when you next deploy) — deploy the server and database rules together, and use the new app build after.** Saving a piece now goes through the server. Once the new rules are live, an OLD copy of the app can't save pieces (it would say "Loane wouldn't accept that"). Normal deploy, nothing to switch on. The live core-flow check after deploying adds two real pieces, so it proves this works.
- From run 39 (only when you next deploy): one small database rules change — a profile photo must be her own upload. Normal deploy, nothing to switch on. The live core-flow check after deploying uploads a real profile photo, so it proves this works on the live project.
- From run 38 (only when you next deploy): server fixes to posting and deleting a look, and to scheduled looks. Normal deploy, nothing to switch on. After deploying, the usual live core-flow check covers it (it posts a real look).
- From run 37 (only when you next deploy): server fixes to the dashboard's take-down, suspend and dispute buttons, plus one tiny database rules addition. Normal deploy, nothing to switch on.
- From run 36 (only when you next deploy): server fixes to sharing into chats and to closing Contact us messages in the dashboard. Normal deploy, nothing to switch on.
- From run 35 (only when you next deploy): server fixes to starting a chat, removing a piece, and Contact us. Normal deploy, nothing to switch on.
- From run 34 (only when you next deploy): server fixes to "Find friends from contacts" and suggested closets. Normal deploy, nothing to switch on.
- From run 33 (only when you next deploy): server fixes to accepting a sale, asking to rent, and the hourly rental clock. Normal deploy, nothing to switch on.
- From run 32 (only when you next deploy): server fixes to comments and to accepting rentals/sales. Normal deploy, nothing to switch on.
- From run 31 (only when you next deploy): small server fixes to following, likes/saves and changing a username. Normal deploy, nothing to switch on.
- From run 30 (only when you next deploy): two server fixes — sign-ups and reviews. Normal deploy, nothing to switch on. Optional: if you'd rather keep the old, tighter sign-up limit (5 an hour from one wifi instead of 30), say so.
- Nothing new from run 29 (no server or database changes — nothing to deploy). Optional 1 minute: scroll the feed fast and type quickly in a long chat — it should feel smoother than before.
- Nothing new from run 28 (no server or database changes — nothing to deploy).
- From run 27 (only when you next deploy): one new server function (`shareProfile`) and a database rules update (new tracked actions, and the rules that guard profile cards in chats). Deploy the rules **at the same time as or before** the app update goes out — normal deploy, nothing to switch on.
- Nothing new from run 26 (no server or database changes — nothing to deploy).
- From run 25 (only when you next deploy): one new dashboard function for deleting an account on a student's behalf — normal deploy, nothing to switch on.
- From run 24 (2 minutes, whenever you next have the app open): turn on **Airplane Mode** and poke around — open the app, open a chat and try sending, open a look. You should see a dark "No internet connection" bar and clear messages, never a frozen spinner or the sign-up screen. The overnight machine can't run a phone, so this is the one thing it couldn't check by hand.
- From run 23 (when you submit to the App Store): Apple needs a public web link to the Privacy Policy, and the privacy form answers are in `docs/app-store-privacy.md`.
- **From run 22 — one decision:** right now ANY .edu email can sign up (a student at Clemson gets her own little "school" made for her automatically — that was set up on Oct 12). Backlog item F7 says non-USC emails should go to a waitlist instead. Doing that means turning those students away, so I didn't build it. Reply "USC only + waitlist" or "keep any .edu" and the next run will do it.
- From run 22 (only when you next deploy): the database rules gained one small allowed field (her Get started answers) and account deletion now lowers the campus student count — normal deploy, nothing to switch on.
- From run 21 (only when you next deploy): it adds new server functions for hearting comments — normal deploy, nothing to switch on.
- Nothing new from run 20.
- Nothing new from run 19.
- Nothing new from run 18.
- Nothing new from run 17. (When you next deploy: it adds an hourly "Trending" job and two database indexes — normal deploy, nothing to switch on.)
- From run 16: OK the feel change — All Campus is ranked "For You" (not newest first), and Discover opens on "For you" instead of "Newest". Following is still newest first.
- New from run 13 (only when you next deploy): after the next deploy to the live project, open the admin dashboard → Overview → **Feature switches** and check it reads: try-on Off, admin preview Off, email codes Off, same-day On, payments Off. Those are the defaults, so it should — but if you'd ever turned on try-on's admin preview on the live project, turn it on again there.
- From run 12 (no rush, all before launch): pick a crash reporter (Sentry free tier is the obvious one), and when you're ready, do the 30-minute console checklist in `docs/production-ops.md` (spending alert, daily backups, error emails).
- Still waiting on an OK from run 10: Followers/Following lists are newest-first instead of A–Z.
- Still open from run 5: whether a deleted account's old @handle should ever be freed up, and when to start flagging "Venmo me" in chats.

---

## 2026-10-27 (run 63, ~6 AM Central) — The dashboard can't bring back a deleted girl's things

**Plan:** Everything left on the backlog still waits on you (F7, H10), on payments (B8) or on a real phone (G8, H5). So, as run 62 suggested, this run re-read the dashboard's Users, Listings, Posts and Comments pages against deleted accounts (backlog H1).

**Built / Fixed (what you would notice):**
- **A deleted girl's taken-down piece or look could be put back up.** If an admin had taken one down and she later deleted her account, "Put it back" would show it on campus again under "Deleted account". The server now refuses, the same way it already did for her comments, and the button is greyed out with the reason written under it.
- **An admin could give a deleted account free try-ons** — it quietly rebuilt part of the data deletion had erased. Now refused, and the button is greyed out.
- **A deleted account's dashboard page said "Active".** It now says "Deleted account" with one line on what's left (rentals, reviews and reports stay as records). The Users list says "deleted" instead of the techy "deactivated".
- **Listings, Posts and Comments now say whose each thing is by her name today**, and you can click it to open her page. Before, they showed the name copied onto the item, not clickable. Searching finds her by her current name too.
- **Posts got a search box and a status filter**, like Listings and Comments already had.
- On a student's page, "Listings" and "Posts" count what's up now (removed ones are still listed underneath).

**What to tap to see it:** Laptop, emulators running: `npm run admin` → sign in as admin@joinloane.com → Posts: type a name in the search box; each look says "By @her" — click it to open her page. Listings: same "By @her" line. To see the lock: take a piece down, delete that test account from her page (Users → her → Delete this account), then back on Listings the piece shows "Her account is deleted, so it cannot come back."

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, the dashboard build, and 363 shared tests (3 new). GitHub ran the full set, database tests included (4 new): **all green ✅**.
- B8 still waits on payments, F7 and H10 on your decisions, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: the server fix above. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.
- Still open from run 57: should a suspended girl's profile look "not found" to other students, or stay visible?

**Next up:** Keep sweeping (H1) — next, re-read the dashboard's Rentals page and Founding Closets against renamed and deleted accounts. Your answer on F7 would unlock the next real feature.

**Commits:**
- A deleted girl's taken-down piece or look can't be put back; no free try-ons for a deleted account; tests
- Dashboard Listings, Posts and Comments name the owner live and grey out what the server would refuse; a deleted account's page says so
- Decisions and North Star notes; autopilot log for run 63

---

## 2026-10-27 (run 62, ~5 AM Central) — The dashboard's numbers count real students, pieces and looks

**Plan:** Everything left on the backlog still waits on you (F7, H10), on payments (B8) or on a real phone (G8, H5). So, as run 61 suggested, this run re-read the dashboard's Overview numbers and Campuses page against deleted and suspended accounts (backlog H1).

**Built / Fixed (what you would notice):**
- **"Total Users" is now "Students", and it's honest.** It used to count the admin login itself and every deleted account, so it could only ever go up. Now it counts girls who still have an account (suspended girls still count — they're paused, not gone). New sign-ups still include girls who later deleted (they did sign up) but never the admin.
- **"Listings" and "Posts" on the Overview** no longer count pieces and looks that were removed or taken down — only what's on Loane today.
- **Each campus card on the Campuses page said 0 pieces, 0 posts, 0 bookings — always.** Nothing had ever kept those three numbers up to date. Now the dashboard counts them exactly each time you open the page: Students, Pieces, Looks, and Rented or sold. While counting it shows a dash, not a fake 0.
- **The Overview no longer says "Showing the latest limited emulator data"** — wrong once it points at the live project. It now says the numbers come from the newest 250 of each, and that Campuses has the exact totals.

**What to tap to see it:** Laptop, emulators running: `npm run admin` → sign in as admin@joinloane.com → Overview: the first card says "Students". Then Campuses: the University of South Carolina card shows real numbers for Pieces, Looks and Rented or sold (from the seeded campus) instead of zeros.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, the dashboard build, and 360 shared tests (6 new). GitHub runs the full set, database tests included, on this push.
- B8 still waits on payments, F7 and H10 on your decisions, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing to deploy from tonight (dashboard only).
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.
- Still open from run 57: should a suspended girl's profile look "not found" to other students, or stay visible?

**Next up:** Keep sweeping (H1) — next, re-read the dashboard's Users list and Listings/Posts pages against deleted accounts (can an admin act on a deleted girl's leftovers?). Your answer on F7 would unlock the next real feature.

**Commits:**
- Dashboard counts students, pieces and looks that are on Loane now; campus cards count live (they sat at 0); test
- Decisions and North Star notes; autopilot log for run 62

---

## 2026-10-27 (run 61, ~4 AM Central) — The dashboard's Activity Log says what happened, and to whom

**Plan:** Everything left on the backlog still waits on you (F7, H10), on payments (B8) or on a real phone (G8, H5). So, as run 60 suggested, this run re-read the dashboard's Activity Log and the phone's Help → Contact us against renames and deleted accounts (backlog H1).

**Built / Fixed (what you would notice):**
- **The Activity Log now reads in plain words.** Before, a row said things like "suspend_user" on "user · 8f3kq2…" by an admin shown as a long code — so nobody could actually tell who got suspended or who did it. Now it says "Suspended her account", on "@her" (her name today, clickable to her page — "Deleted account" if she's gone), by "admin@joinloane.com". Its empty message no longer says the moderation tools "don't exist yet" (they've existed for weeks).
- **A student's dashboard page now lists every admin action on her account** — suspensions, notes, data exports, try-on grants — with who did it and why. The Activity Log only shows the latest 100 actions across everyone, so an old suspension used to fall off and be forgotten.
- **In the app, Help → Past reports** no longer flashes "Your reports will appear here" while it's still loading (for a second it looked like her reports were gone). Statuses now read **Sent / Being looked at / Handled / Closed** instead of the admin's words — a girl who reported someone never sees "Dismissed".

**What to tap to see it:** Dashboard (laptop, emulators running): `npm run admin` → sign in as admin@joinloane.com → suspend any student from her page with a reason → Activity Log: the top row says "Suspended her account" on her @name → click her name → scroll to "Admin Actions On Her Account". Phone: ☰ → Help → scroll to "Past reports".

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, the dashboard build, and 354 shared tests (5 new). GitHub ran the full set, database tests included: **all green ✅**.
- B8 still waits on payments, F7 and H10 on your decisions, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing to deploy from tonight (dashboard and app only).
- Small one: the audit log keeps a deleted girl's old @username on the line that records her deletion (admins only). Left as is — say if you want it gone.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.
- Still open from run 57: should a suspended girl's profile look "not found" to other students, or stay visible?

**Next up:** Keep sweeping (H1) — next, re-read the dashboard's Overview numbers and Campuses page against deleted and suspended accounts (do they still count?). Your answer on F7 would unlock the next real feature.

**Commits:**
- Dashboard Activity Log in plain words, with who it was done to by current name; her page lists admin actions on her account; tests
- Help → Past reports: loading line instead of a false empty; statuses in her words (never "Dismissed"); test
- Decisions and North Star notes; autopilot log for run 61

---

## 2026-10-27 (run 60, ~3 AM Central) — Contact us messages and claims show the right girl

**Plan:** Everything left on the backlog still waits on you (F7, H10), on payments (B8) or on a real phone (G8, H5). So, as run 59 suggested, this run re-read the admin dashboard's Support (Contact us) and Claims pages against renames and deleted accounts (backlog H1).

**Built / Fixed (what you would notice in the dashboard):**
- **Deleting an account now takes her name off her Contact us messages.** Before, every message she'd sent kept her name, @handle and photo forever — the Privacy Policy says her personal info is deleted or anonymized. Now they say "Deleted account". The message itself stays, so an open one (say, a safety worry) can still be handled.
- **The Support inbox shows who sent each message by her name today**, clickable to her page. Before, it showed the name from the day she wrote — after a rename that could be a handle someone else now owns.
- **Damage Claims now say who** — "Lender @her / Renter @her", each clickable. Before, a claim showed only an amount and a description. (Claims stay empty until payments are on; the page is ready for then.)
- **A student's page now lists her Contact us messages**, open ones first, under the reports about her — so you see everything about her in one place.

**What to tap to see it:** On your laptop with the emulators running: `npm run admin` → sign in as admin@joinloane.com → Support: the "From" column shows each girl's current @name — click it to open her page. Users → any student → scroll to "Her Contact Us Messages". To see the deletion fix: in the app, a student sends Help → Contact us, then deletes her account → in Support that message now says "Deleted account".

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, the dashboard build, and 349 shared tests (4 new). GitHub ran the full set, the new deletion test and database tests included: **all green ✅**.
- B8 still waits on payments, F7 and H10 on your decisions, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: this server fix. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.
- Still open from run 57: should a suspended girl's profile look "not found" to other students, or stay visible?

**Next up:** Keep sweeping (H1) — next, re-read "Contact us" itself on the phone (Help screen) and the dashboard's Activity Log page against deleted accounts. Your answer on F7 would unlock the next real feature.

**Commits:**
- Deleting an account takes her name off her Contact us messages (they kept it); test
- Dashboard Support and Claims show who by current name, clickable; her page lists her Contact us messages; test
- Decisions and North Star notes; autopilot log for run 60

---

## 2026-10-27 (run 59, ~2 AM Central) — The dashboard shows who a report is about

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So, as run 58 suggested, this run re-read the admin dashboard's Reports and Users pages against renames and deleted accounts (backlog H1).

**Built / Fixed (what you would notice in the dashboard):**
- **Reports now say WHO.** Each report shows "About @her" and "From @her" — her name today, not an old one. Before, a report only said "post" or "message", so pressing "Suspend her" meant acting on someone you couldn't see. Click her name to open her page. A deleted account says "Deleted account"; an already-suspended girl says "(suspended)"; reports from the word filter say "Automatic filter".
- **A student's page now lists the reports about her**, open ones first, with what was reported and who reported it — so you can see "third report this month" at a glance before deciding.
- **Private notes can now be read.** "Add a private note" has saved notes for weeks, but the box meant to show them was greyed out saying "Backend needed", so no admin ever saw a note again. Now her page lists her notes, newest first, with who wrote each and when, and an "Add a private note" button right there.
- Checked and fine as it was: the dashboard's Rentals, Comments, Listings and Posts pages already show current names (earlier runs keep those copies up to date).

**What to tap to see it:** On your laptop with the emulators running: `npm run admin` → sign in as admin@joinloane.com → Reports: every row has a "Who" column — click the "About" name to jump to her page. On her page (Users → any student): scroll down to "Reports About Her", and "Private Notes" → Add a private note → it appears in the list straight away.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, the dashboard build, and 345 shared tests (6 new). Nothing on the server or database changed tonight. GitHub ran the full set, database tests included: **all green ✅**.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing new — nothing to deploy from tonight.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.
- Still open from run 57: should a suspended girl's profile look "not found" to other students, or stay visible?

**Next up:** Keep sweeping (H1) — next, re-read the dashboard's Support (Contact us) and Claims pages against deleted accounts and renames. Your answer on F7 would unlock the next real feature.

**Commits:**
- Dashboard reports show who they are about and who filed them, by current name; deleted accounts say so; test
- A student's dashboard page lists her private notes and the reports about her (notes were write-only)
- Decisions and North Star notes; autopilot log for run 59

---

## 2026-10-27 (run 58, ~1 AM Central) — A new @username reaches her rentals and reviews

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So, as run 57 suggested, this run re-read rentals and Activity alerts against a girl renaming herself (backlog H1).

**Built / Fixed (what you or a student would notice):**
- **A rental in progress now shows the other girl's current @name.** Before, if she changed her username mid-rental, the rental screen, My Rentals and Rental requests kept saying "Renting from @oldname" while the chat beside it showed the new one — confusing right when two girls are arranging a handoff. Finished rentals (done, cancelled, declined) keep the name they had, as a record of what happened.
- **Reviews she wrote now follow her new name.** Before, a review kept her old @name forever. Since an old name is freed when she renames, another girl could take it — and the review then looked like it was written by her. The review's words, stars and date don't change.
- Checked and fine as it was: tapping an Activity alert already opens the right girl even after a rename. The alert's words keep the old @name, but they clear after 30 days.

**What to tap to see it:** On the emulators: sign in as girl A → ask to rent one of girl B's pieces → sign in as B → Profile → Edit profile → change her @username → back as A: My Rentals → open the rental: "Renting from" shows B's new name. For reviews: finish a rental, have A review B, then rename A → open B's Reviews: the review shows A's new name.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (no new index needed), 339 shared tests and 164 server tests that don't need the database. The four new database tests ran on GitHub with the full set: **all green ✅**.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: this server fix. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.
- Still open from run 57: should a suspended girl's profile look "not found" to other students, or stay visible?

**Next up:** Keep sweeping (H1) — next, re-read the admin dashboard's Users and Reports pages against renames and deleted accounts (they show copies of names too). Your answer on F7 would unlock the next real feature.

**Commits:**
- A girl's new name reaches the rentals she has going (finished ones keep the old one); tests
- Reviews she wrote follow her new name, so an old handle someone else takes never sits on her review; test
- Decisions and North Star notes; autopilot log for run 58

---

## 2026-10-27 (run 57, ~12 AM Central) — Tapping a name always opens the right girl

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So, as run 56 suggested, this run re-read the profile screen and chats against renaming and account deletion (backlog H1).

**Built / Fixed (what you or a student would notice):**
- **Tapping a girl's name or photo now always opens her — even after she changes her @username.** Before, most taps (on a review, comment, look, piece, chat, liker list, search result, suggestion, Trending) looked her up by her @name. Reviews never update the name they show, so after a rename those taps said "Closet not found" — or, if someone else had since taken her old @name, opened that other girl's closet instead. Now every tap uses her account number, which never changes.
- **A chat with a girl who deleted her account is now properly read-only.** The "…" (Report or block) is gone — there's nobody left to block, and Loane already refuses reports on a deleted profile. Swiping or pressing "Reply" on her old messages used to open a reply box with nowhere to type; that's gone too. Pressing and holding one of her messages still lets you Like or Report it.
- Checked and fine as it was: people search and Find friends never show deleted accounts; follower and "liked by" lists hide blocked girls; a deleted girl's profile says "Account deleted"; and nobody can ever take a deleted girl's @name.

**What to tap to see it:** On the emulators: sign in as a student → leave a review for someone → as the reviewer, Profile → Edit profile → change your @username → as the other girl, open her Reviews → tap the reviewer: her closet opens (it used to say "Closet not found"). For the chat: message someone → sign in as her and delete her account → back as the first girl, open that chat: no "…" at the top, and holding a message shows only Like and Report.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, 339 shared tests (4 new) and 192 server tests that don't need the database. Tonight's changes are phone-app only, so no database tests were affected; GitHub runs the full set on this push.
- A suspended girl's profile still opens normally, with Follow and Message buttons that then say "not available". That's a moderation choice, so I added it to the backlog as a suggestion rather than changing it.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing new — nothing to deploy from tonight.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.
- New, no rush: should a suspended girl's profile look "not found" to other students (like Instagram), or stay visible? Reply either way.

**Next up:** Keep sweeping (H1) — next, re-read rentals and the Activity alerts against renames (a rental shows a copy of each girl's name too). Your answer on F7 would unlock the next real feature.

**Commits:**
- Every tap on a name opens her by account id, so a renamed or deleted girl never opens the wrong closet; test
- A chat with a deleted account: no Report-or-block menu and no Reply that leads nowhere; her messages can still be reported
- Decisions and North Star notes; autopilot log for run 57

---

## 2026-10-27 (run 56, ~11 PM Central) — Muted girls stop being suggested; a deleted girl's name leaves other girls' Activity

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So, as run 55 suggested, this run re-read suggested closets and "Find friends from contacts" against muting, and fixed the leftover alerts noted in run 53 (backlog H1).

**Built / Fixed (what you or a student would notice):**
- **A girl you've muted no longer shows up in "Closets you might like".** Muting means "I don't want her looks", so suggesting you follow her made no sense. If you mute or block someone while the row is on screen, she drops out of it straight away. She is never told, and being muted by someone doesn't change what you see — so nobody can work out they were muted.
- **When a girl deletes her account, the alerts she caused in other girls' Activity go too** ("@her liked your look", "@her started following you"). Before, those kept her old @name and photo for up to a month, even though the Privacy Policy says she's gone. Her past rentals were already relabelled "Deleted account" in run 53; this finishes the job. Works the same when an admin deletes the account from the dashboard.
- Checked and left as it is, on purpose: "Find friends from contacts" and search still find a girl you've muted. That's you looking her up, not Loane recommending her — Instagram does the same.

**What to tap to see it:** On the emulators: sign in as a student → on a look in the feed, "…" → Mute → scroll to "Closets you might like": she isn't in it. For the alerts: as girl A, like girl B's look → sign in as A → Settings → Delete my account → sign in as B → Activity: no alert naming A.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (it caught that the new alert clean-up needed an index, which is now added), 335 shared tests and 164 server tests that don't need the database. The two new database tests ran on GitHub with the full set: **all green ✅**.
- Alerts from accounts deleted before this goes live stay until the normal 30-day clean-up — not worth a one-off script.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these two server fixes plus one new database index. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping (H1) — next, re-read Discover's people search and the profile screen against muting and deletion (e.g. what a girl sees opening a deleted account from an old chat or comment). Your answer on F7 would unlock the next real feature.

**Commits:**
- Suggested closets leave out girls she has muted (server and the feed row); test
- Deleting an account also removes other girls' Activity alerts that name her; one new index; test
- Decisions and North Star notes; autopilot log for run 56

---

## 2026-10-27 (run 55, ~3 AM Central) — Blocked and Muted lists tell the truth

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So, as run 54 suggested, this run re-read muting and hiding a user (B3) against account deletion and blocking (backlog H1).

**Built / Fixed (what you or a student would notice):**
- **Settings → Blocked and Settings → Muted no longer say "Nobody blocked" when they just couldn't check.** On a bad signal they used to show that for good, which looks like a block came undone. Now they say "Couldn't load your blocked list" with a Try again button. They also no longer flash "Nobody blocked" for a split second while opening.
- **Deleted accounts no longer sit in those lists.** If a girl you'd blocked or muted deletes her account, you used to see "@deleted-… Deleted account" with an Unblock button that led nowhere. She's gone for good, so the row is gone too.
- **Muting someone with no signal now says "No internet connection"** instead of "Could not mute right now. Try again."
- Checked and fine as it was: a muted girl is never told, nobody can see who muted them (not even in "Download my data"), and deleting your account erases your own muted list.

**What to tap to see it:** On the emulators: sign in as a student → block someone → sign in as that girl and delete her account → sign back in as the first student → Profile → ☰ → Settings → Blocked: the list is empty, not a "Deleted account" row. For the offline part: Airplane Mode → Settings → Blocked → "Couldn't load your blocked list" with Try again.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, 335 shared tests and 178 server tests that don't need the database. Tonight's changes are phone-app only, so no database tests were affected; GitHub runs the full set on this push.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing new — nothing to deploy from tonight.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping (H1) — next, re-read "Find friends from contacts" and suggested closets against muting (should a muted girl still be suggested?) and the Activity alerts that still show a deleted girl's old handle (noted in run 53). Your answer on F7 would unlock the next real feature.

**Commits:**
- Blocked and Muted lists: say "Couldn't load" with Try again instead of a false "Nobody blocked", no empty flash while loading, and leave out deleted accounts
- Muting or unmuting with no signal says "no internet" instead of "try again"
- Decisions and North Star notes; autopilot log for run 55

---

## 2026-10-26 (run 54, ~6 AM Central) — "Download my data" no longer gives away the other girl's chat settings

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So, as run 53 suggested, this run re-read "Download my data" against account deletion and blocking (backlog H1).

**Built / Fixed (what you or a student would notice):**
- **Your data file now only shows your side of each chat.** Before, it also showed the other girl's side: whether she'd read your messages (even if she'd turned "Show read receipts" off), whether she'd muted the chat, and whether she'd deleted it from her inbox. The app never shows any of that, and Instagram's own data download doesn't either. Every message in the chat is still in the file, both sides, as before.
- Checked and fine as it was: a deleted girl's leftovers, chats with someone you blocked (or who blocked you), and messages an admin took down (already blanked). Nothing in the file says who has blocked you.

**What to tap to see it:** On the emulators: sign in as a student who has a chat → Settings → Download my data → in the file, under each chat, the unread count, "last read" and mute only list you.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 335 shared tests and 178 server tests that don't need the database. The new database test ran on GitHub with the full set: **all green ✅**.
- Not changed, on purpose: the two girls' phones can still read each other's side of a chat's settings behind the scenes (the badge and "Seen" need it). Only a tampered app could get at it; fixing that means rebuilding the inbox, which isn't worth it now. Noted in `docs/decisions.md`.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: this server fix. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping (H1) — next, re-read muting and hiding a user (B3) against deletion and blocking the same way. Your answer on F7 would unlock the next real feature.

**Commits:**
- Download my data shows only her side of a chat's unread counts, read times, mutes and deletes; tests
- Decisions and North Star notes; autopilot log for run 54

---

## 2026-10-26 (run 53, ~5 AM Central) — A deleted girl's name comes off old rentals

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So, as run 52 suggested, this run re-read reviews and reports against "Delete my account" (backlog H1).

**Built / Fixed (what you or a student would notice):**
- **Deleting an account now takes her name and photo off past rentals.** Our Privacy Policy says old rentals are kept "without your name", but each rental keeps its own copy of both girls' names, and nothing was clearing it. So the girl she rented with still saw "@her" in My Rentals forever. Now it reads "Deleted account". The money, dates and piece stay exactly as they were.
- **You can't review someone who deleted her account.** Before, it went through and quietly dropped a "You got a review" alert into the account we'd just emptied. The "Review @…" button now disappears, and an older app gets a clear message instead.
- **You can't report a deleted account's (empty) profile.** The dashboard can't act on one anyway, so those reports would sit open forever. Her old rentals, reviews and messages can still be reported.

**What to tap to see it:** On the emulators: finish a rental between two students → delete one account in Settings → sign in as the other girl → Profile → My Rentals → open that rental: it says "Deleted account" and there is no "Review" button.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 335 shared tests and 160 server tests that don't need the database. The 3 new database tests ran on GitHub with the full set: **all green ✅**.
- Not fixed, on purpose: other girls' Activity alerts that mention her ("@her liked your look") keep her old handle until they're cleared automatically after 30 days. Fixing it means searching everyone's alerts — a bigger change than it's worth.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping (H1) — next, re-read the data export ("Download my data") against deletion and blocking. Your answer on F7 would unlock the next real feature.

**Commits:**
- Deleting an account takes her name and photo off past rentals; a deleted girl can't be reviewed or reported as a profile; app hides the review button for her; tests
- Decisions and North Star notes; autopilot log for run 53

---

## 2026-10-26 (run 52, ~4 AM Central) — A deleted girl's comments can't come back

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1 by re-reading the dashboard's take-down buttons against "Delete my account", looking for the same kind of slip found on earlier nights.

**Built / Fixed (what you or a student would notice):**
- **Deleting an account now takes down comments you'd already hidden.** Before, only her visible comments came down. One you'd hidden in the dashboard stayed "hidden", so pressing "put it back" later would show a deleted girl's words under someone's look again.
- **The dashboard won't put back a comment from a deleted account.** It says "Her account is deleted, so her comment cannot come back." This also covers accounts deleted before tonight's fix.
- **Hiding a comment can't make a look's comment count go below zero.** Her own Delete already had this guard; the dashboard didn't.
- Her looks and pieces were already safe — deleting an account takes those down whatever state they're in.

**What to tap to see it:** On the emulators: dashboard → Reports (or a look's comments) → take down a comment → then delete that student's account → try "put it back": it refuses with the message above.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 335 shared tests and 160 server tests that don't need the database. The 3 new database tests ran on GitHub with the full set: **all green ✅**.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping (H1) — next, re-read reviews and reports against account deletion the same way. Your answer on F7 would unlock the next real feature.

**Commits:**
- Deleting an account also takes down her admin-hidden comments; the dashboard won't bring back a deleted girl's comment; hiding a comment never takes a look's count below zero; tests
- Decisions and North Star notes; autopilot log for run 52

---

## 2026-10-26 (run 51, ~3 AM Central) — Publishing Terms and Privacy is safe from double-clicks and typos

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1 with the last server pieces that had no tests at all: publishing Terms/Privacy from the dashboard, a student accepting them, and private admin notes.

**Built / Fixed (what you or a student would notice):**
- **Two people pressing Publish on the Terms at the same moment can't put two new versions live.** Before, one of you got "something went wrong" — or, worse, both versions could go out back to back. Now one wins and the other is told "Someone just published a new version. Reload and check it before publishing."
- **The "effective date" must be a real day.** Before, a typo like 2026-13-45 was accepted and would have shown at the top of the Terms.
- **Saving a draft again keeps the date you started it.**
- **Accepting the Terms only records a real answer.** A tampered app could send junk and still be marked as agreeing; and a deleted account could be stamped as agreeing today. Both are refused now, so the "she agreed on…" date stays trustworthy.
- Private admin notes on a student (dashboard → Users → a student → note) now have tests. They already worked.
- No legal wording was changed.

**What to tap to see it:** On the emulators, open the dashboard → Legal → type an effective date of 2026-02-30 → Publish: it says to use a real date. Open the dashboard in two browser tabs, write a change in both, and press Publish in each at the same time: only one new version appears.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 335 shared tests and 160 server tests that don't need the database. The 15 new database tests ran on GitHub with the full set: **all green ✅**.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Every server function outside Try-On now has tests. Next runs keep sweeping (H1) by re-reading older functions for the same kinds of slips. Your answer on F7 would unlock the next real feature.

**Commits:**
- Terms and Privacy: two admins publishing at once can't make two new versions; effective date must be a real day; a draft keeps when it was started; accepting refuses non-numbers and missing or deleted accounts; tests
- Tests for private admin notes on a student
- Decisions and North Star notes; autopilot log for run 51

---

## 2026-10-26 (run 50, ~2 AM Central) — Chats only move in Messages when someone writes

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run finished H1's last untested pieces outside Try-On — the "is this username free?" check and the helpers behind sharing into chats — and did H2 (small tidy-ups).

**Built / Fixed (what a student would notice):**
- **Opening a chat no longer shuffles Messages.** Tapping "Message" on someone's profile (or on a piece) and backing out moved that chat to the top of *both* girls' inboxes, above chats with real new messages. Now it stays where it was.
- **Reading a chat no longer shuffles Messages either.** Opening an older chat to read it floated it above newer ones, for both of you. Now only a new message (or a heart on one) moves a chat — like Instagram.
- **A message you take down in the dashboard doesn't bump the chat** to the top of their inboxes.
- **The "is this username free?" check can't be crashed** by junk sent from a tampered app; it gives the normal "needs at least 3 characters" answer. It now has tests (free, taken in any capitals, reserved names, junk).
- Small tidy-ups: no lint warnings left; every remaining "to do" note in the code waits on payments, real email checks or later phases, so H2 is done.

**What to tap to see it:** Have chats with two people, where the older one is lower down. Tap the older one, read it, go back: it stays lower. Then go to that girl's profile → Message → back: Messages hasn't changed order. Send her something: now it jumps to the top.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 335 shared tests and 160 server tests that don't need the database (5 new). The new database tests (4 for the username check, 1 for chats, 1 for take-downs) ran on GitHub with the full set: **all green ✅**.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes, and use the new app build after. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** The backlog is now done except the items waiting on you or a phone. Next runs: keep sweeping (H1) — the Try-On and email-code functions are switched off, so the next useful sweep is re-reading older tested functions for the same kind of slip found tonight. Your answer on F7 would unlock the next real feature.

**Commits:**
- Opening a chat no longer floats it up both inboxes; the username check takes junk without crashing; tests for the username check and share input
- Tidy: formatting in two test files
- Reading a chat or a take-down no longer reorders the inbox; only a new message (or heart) moves a chat; test
- Decisions and North Star notes; autopilot log for run 50

---

## 2026-10-26 (run 49, ~1 AM Central) — "Find friends from contacts" can't be hijacked; sign-up names go past the word filter

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1, taking what run 48 pointed at: the jobs that run edited captions, piece text and bios past the word filter, and the job behind "Find friends from contacts".

**Built / Fixed (what a student would notice):**
- **Nobody can borrow your phone number to be found as you.** Nobody proves a number is theirs — she just types it in Settings. Before, if Anna typed Ella's number into her own settings, Ella's friends would find *Anna* under "Find friends from contacts", and stop finding Ella. Now a number two accounts have both saved finds neither, until one of them removes it.
- **Removing your number only removes you.** Before, if Anna then deleted that number, it wiped it for Ella too, so Ella vanished from her friends' contacts.
- **Changing your number twice fast ends on the right one.** Before, the older change could finish last and leave her old number still finding her.
- **Sign-up names and @usernames are checked by the word filter now.** Captions, comments, messages and bios always were, but the name and @username she signs up with (and a later @username change) never were. A match puts a report in the dashboard's Reports queue for you to look at. It never stops her signing up.
- The word-filter jobs for edited captions, pieces and bios now have tests (they already worked).

**What to tap to see it:** On the emulators, sign up with the username `test.go.die` → open the dashboard → Reports: there's one from "the content filter" about her. For contacts: give two test accounts the same phone number in Settings, then on a third account tap Find friends from contacts with that number saved in the phone — neither shows. Remove it from one account and try again: the other one shows.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, 335 shared tests and the server tests that don't need the database (10 new). The 11 new database tests ran on GitHub with the full set: **all green ✅**.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes. Normal deploy, nothing to switch on.
- Worth knowing, not urgent: someone can still *hide* a girl from her friends' contacts by saving her number too. The only real fix is texting a code to prove the number is hers, which costs money per text — your call, whenever.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** The last untested server pieces outside Try-On (H1): the "is this username free?" check on sign-up (checkUsername) and the push-alert sender (sendToEach). Then H2 (small tidy-ups).

**Commits:**
- Contact matching: a number two accounts save matches neither, letting go only removes her, and quick edits end on her current number; sign-up names and new usernames go past the word filter; tests for the edited-text filter jobs
- Decisions and North Star notes; autopilot log for run 49

---

## 2026-10-26 (run 48, ~12 AM Central) — The inbox always shows the newest message; prices on tags and booked dates stay right

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1, taking what run 47 pointed at: the background jobs that update the inbox when a message or heart arrives, copy a piece's name and price onto the looks that tag it, and grey out the days a piece is booked.

**Built / Fixed (what a student would notice):**
- **The inbox shows the newest message, always.** Send two messages a second apart and the inbox could show the *first* one as the latest. Same if a heart and a new message landed together. Now the newest one wins.
- **One message counts as one unread.** If the server happened to handle the same message twice, her badge went up by two. Now it's one.
- **A message's time comes from Loane, not the phone.** A tampered app could date a message next year, so it sat at the bottom of the chat forever and never showed "Seen". Now Loane refuses any time but its own. The real app already does it this way, so nothing changes for her.
- **Prices on tagged pieces stay current.** Change a price twice in a row and the older one could end up on every look that tags the piece. Now the newest price wins. And if she edits a look while this happens, her edit is no longer undone.
- **Booked days stay right.** If a rental was accepted and another cancelled at the same moment, the calendar could grey out a weekend that was free (or show a booked one as free). Asking to rent was always double-checked, so nobody could double-book, but now what she sees is right too.

**What to tap to see it:** Open a chat and send two messages fast, one after the other. Go back to Messages: the second one shows as the preview. Then Profile → a piece you've tagged in a look → Edit → change the price twice quickly → open that look and tap the tag: it shows the newest price.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 335 shared tests and 146 server tests that don't need the database (16 new). The 15 new database tests and 1 new rules test ran on GitHub with the full set: **all green ✅**.
- One small thing left on purpose: if the server handles an *older* message twice after a newer one has already arrived, it still counts twice. Very rare, costs one extra unread. Explained in `docs/decisions.md`.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes and the small rules change. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1): the jobs that flag edited captions, piece descriptions and bios (flagEditedCaption, flagProfileAndListingText) and the phone-number matching job (syncPhoneHash). Or H2 (small tidy-ups).

**Commits:**
- Inbox preview never shows an older message over a newer one; a message counted once even if processed twice; message times set by the server; tag labels and booked dates always use the newest data; tests
- Decisions and North Star notes; autopilot log for run 48

---

## 2026-10-26 (run 47, ~11 PM Central) — New names and photos spread properly; the "tapped a tagged piece" number stays honest

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1, taking what run 46 pointed at: the background jobs that copy a girl's new name and photo onto her old looks, pieces, comments and chats, and the counters for look views, piece views and tagged-piece taps.

**Built / Fixed (what a student would notice):**
- **Changing your photo no longer shuffles everyone's Messages.** Every chat she was in jumped to the top of her inbox *and* the other girl's, above chats with real new messages. Now chats only move when someone writes.
- **A quick double rename ends on the newest name.** Change your username twice fast and the old one could win and stay on all your looks and chats. Now the newest always wins.
- **Deleting a look while your new name is being copied doesn't stop the rest.** Before, that could leave her old name on a batch of looks and on every chat.
- **The "tapped a tagged piece" number only counts real taps.** That's the number that tells us whether the social side drives rentals. A tap now only counts for the look that actually tags that piece. Junk sent by a phone is ignored instead of crashing the counter.

**What to tap to see it:** Open two chats with different people so one is on top, then change your profile photo (Profile → Edit profile). The order in Messages stays the same, and your new photo shows in both chats. Change your username, then open one of your old looks: it shows the new @handle.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 330 shared tests and 135 server tests that don't need the database (8 new). The 11 new database tests ran on GitHub with the full set: **all green ✅**.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1): the jobs that keep a look's tagged-piece labels and a piece's "available" status up to date (refreshTagLabels, syncListingAvailability), and the message-sent trigger. Or H2 (small tidy-ups).

**Commits:**
- Name and photo changes: newest profile wins, chats stay in place in the inbox, a deleted look no longer stops the rest; tag taps only credit the look that tags the piece; tests
- Decisions and North Star notes; autopilot log for run 47

---

## 2026-10-26 (run 46, ~10 PM Central) — Sign-up counts properly; disputes and sales tidied up

**Plan:** Everything left on the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1 (testing server code nobody had tested), as run 45 suggested: the dashboard's "Decide this dispute" button with sales in mind, then sign-up itself, which had no tests at all.

**Built / Fixed (what a student would notice):**
- **New girls now actually count on their campus.** Sign-up saved her +1 in the wrong place, so a campus's student count never went up (but deleting an account still took one off). That's the number behind "Join 120+ girls at USC" on the welcome screen and the Campuses page in the dashboard. Fixed. The live numbers need one recount (see NEEDS ZACK). The new sign-up tests caught this one.
- **A girl on a school's second email address joins her school.** Many schools give out two kinds of address (clemson.edu and g.clemson.edu). Before, the first girl on g.clemson.edu got a "school" all to herself: empty feed, nobody to rent from. Now she joins Clemson, and a USC address like mailbox.sc.edu joins USC. Schools already made the old way are left alone. This doesn't change *who* can sign up; that's still your F7 decision.
- **When an admin decides a dispute, both girls are asked for a review**, the same as any finished rental. Before, a decided dispute never asked.
- **A finished sale never brings back a piece the admin took down.** If an admin took a piece down while a sale was going through, finishing the sale used to put it back up on her closet. Now it stays down, and if it's ever put back, it comes back as "sold". Old disputed sales (from before run 43) now end with the piece marked sold instead of buyable.
- Dashboard: each "Decide" starts fresh at "Inconclusive" (it used to remember your last pick), and a disputed sale is labelled "Sale".
- Junk sent to sign-up gets the form's normal answer instead of "Something went wrong".

**What to tap to see it:**
- Sign up a new test account on the emulators with any .edu email, then open the dashboard → Campuses. "Users" goes up by one.
- Sign up with `someone@g.anyschool.edu`, then a second with `someone2@anyschool.edu`. Both land on the same campus.
- Dashboard → Rentals → Needs review → Decide. Both girls get "Loane reviewed your rental" plus "How was renting…?" in Activity.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, 330 shared tests and 155 server tests. GitHub ran the full set, database tests included: **all green ✅** (650+ tests). One push went red first: that's how the count bug showed up. It was fixed in the next commit.
- B8 still waits on payments, F7 on your decision, and G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes, then run the campus recount once (command at the top of this log). Nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1): the background jobs that copy a girl's new name and photo onto her old posts and pieces, and the piece-view and look-engagement counters. Or H2 (small tidy-ups).

**Commits:**
- Deciding a dispute ends it like any finished rental; a finished sale never puts a taken-down piece back up; tests
- Sign-up: girls on a school's other addresses join the same campus; junk sign-up input gets the form's answer; tests
- Sign-up now really counts each new student on her campus; a recount script for the live counts
- Decisions and North Star notes; autopilot log for run 46

---

## 2026-10-25 (run 45, ~6 AM Central) — "Today" means today in Columbia; requests for tomorrow stop vanishing

**Plan:** The rest of the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run took H9, which run 44 flagged: the app worked out "today" on world time, which flips to tomorrow at 8 PM in Columbia. Make every rental date use Columbia's day, on the phone and the server, carefully and with tests.

**Built / Fixed (what a student would notice):**
- **After 8 PM, today is still today.** Before, from 8 PM on the rental calendar greyed out today, the two-week strip on a piece started tomorrow, and a same-day request was treated as an ordinary one for "tomorrow". Now the calendar, the strip, blocked dates, the closet calendar, same-day pickup and the server's checks (asking, saying yes, buying, blocking dates) all use Columbia's day.
- **A request for today or tomorrow no longer disappears within the hour.** This was the big one, found on the way. The deadline for answering was set to "midnight the day before it starts" on world time — which, for anything starting today or tomorrow, was already in the past. So the hourly clock expired the request before the lender could answer it. Gameday tomorrow is the most common ask Loane will get. Now the lender gets 24 hours (2 for same day), but never past midnight as the rental day begins, and never less than 2 hours.
- **Both girls are told the real time left.** "She has 9 hours" instead of always "24 hours" — on the request screen, in the "Request sent" message, in the lender's alert and on the rental page.
- Phones whose software doesn't know time zones still get Columbia's day (worked out by hand, checked against the real answer every hour for two years).

**What to tap to see it:**
- After 8 PM: open any piece → Loane It. Today's date should be pickable (not greyed out), and if the lender offers same day it says "Same-day pickup".
- Ask to rent something starting tomorrow. The footnote under Send says how many hours she has (e.g. "She has 9 hours"). Open Activity an hour later — the request should still be waiting, not "Expired".

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, 323 shared tests (11 new) and the 141 server tests that don't need the database. GitHub ran the full set, database tests included — **all green ✅**.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: these server fixes. Deploy the server and send out the new app build together. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1): the admin dispute screen with sales in mind and the remaining dashboard buttons. Or H2 (small tidy-ups).

**Commits:**
- Columbia's day everywhere for rental dates; requests for today or tomorrow no longer expire before the lender sees them; tests
- Decisions and North Star notes; autopilot log for run 45
- GitHub checks on the code push (full set, database tests included): **all green ✅**

---

## 2026-10-25 (run 44, ~5 AM Central) — Rental reminders arrive on the right day, and never at night

**Plan:** The rest of the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1 with what run 43 pointed at: the hourly rental clock's reminders ("starts tomorrow", "drop off today", "due back", "overdue", "a request is about to expire"). Read it, fix what was wrong, add tests.

**Built / Fixed (what a student would notice):**
- **"Drop off today", "Pick up today" and "Due back today" now arrive on the actual day.** The server's clock runs on world time, which flips to the next day at 8 PM in Columbia — so these reminders were landing at 8 PM the evening before, and "This is overdue" went out at 8 PM on the day it was due. They now go by Columbia's day.
- **No reminder buzzes her phone at night.** Reminders only go out between 8 AM and 9 PM. Anything held back goes at 8 AM.
- **No "Due back today" after she's already handed it back**, and no double reminders if two clock runs overlap.
- **Every rental gets its reminders once Loane is busy.** The clock used to look at only the first 300 live rentals, in no particular order — past that, some girls would silently never be reminded. It now only looks at the rentals that could need one (starting today/tomorrow, due back soon or just late).
- **Tapping "A request is about to expire" opens the request.** Before, that alert could open nothing.
- "This is overdue" says "Wed, Nov 4" instead of "2026-11-04".

**What to tap to see it:** Nothing new to tap — these are alerts. To check by hand: book a rental that starts tomorrow, then in the dashboard run the booking clock; both girls get "starts tomorrow" in Activity. (Running it by hand from the dashboard always sends, whatever the hour.)

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 312 shared tests and 127 server tests that don't need the database (11 new). The 5 new database tests ran on GitHub — **all green ✅**.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.
- Noticed, not changed: the rest of the app (the calendar, request checks) also uses world time, so after 8 PM in Columbia "today" is greyed out and a same-day request is treated as tomorrow's. It touches booking dates, so it's logged as a new backlog item (H9) for a careful run rather than squeezed in here.

**🚨 NEEDS ZACK:**
- When you next deploy: the reminder fix and one new database index. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** H9 (Columbia's "today" everywhere), or keep sweeping untested server code (H1): the admin dispute screen with sales in mind and the remaining dashboard buttons.

**Commits:**
- Rental reminders on campus time, never at night; each sent once inside a transaction; tests
- Decisions and North Star notes; autopilot log for run 44
- GitHub checks on the code push (full set, database tests included): **all green ✅**

---

## 2026-10-25 (run 43, ~4 AM Central) — Buying a piece now ends properly; rental steps tested

**Plan:** The rest of the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1, taking what run 42 pointed at: the steps after a yes (drop-off, "I have it", return, flagging a problem, cancelling) and buying a piece (Own It). Read each, fix what was wrong, add tests.

**Built / Fixed (what a student would notice):**
- **A sale ends when the buyer taps "I have it".** Before, buying a piece went down the rental path: after she had it, the app told her to "return it by the end date" and showed an "I've returned it" button — for something she'd bought. The piece only showed as sold after someone pressed "returned". Now "I have it" finishes the sale: the piece shows as sold, and both girls are asked for a review.
- **The rental page reads like a sale on a sale:** "She's asked to buy this", "Sold to her. Record the hand-over with a photo", "It's yours." / "Sold.", and "Cancel sale" instead of "Cancel rental".
- **The seller can record the hand-over on a sale.** A sale was saved with a few parts missing, so "I've dropped it off" on a sale failed with "Something went wrong". Fixed, and the saved record now matches a rental's exactly.
- **A piece that's late back with a renter can't be bought.** Before, a buyer could ask for it, the seller could never say yes, and the buyer waited a day for nothing. Now she's told "On Loane right now."
- **The message with a rental or buy request is checked** (must be text, up to 500 characters), and junk gets a clear answer without using up one of her requests for the hour.
- "Report a return problem" and returns are refused on a sale (nothing comes back). A problem with a sale goes through Report a problem, like anything else.
- If any sale was already stuck at "she has it" from before, either girl gets a "Finish the sale" button.

**What to tap to see it:**
- On a piece that's for sale, as a second student: Own It → send. As the seller: Rental requests → open it → Accept → "I've dropped it off" (take a photo). As the buyer: open the rental → "I have it". It should say "It's yours." and the piece should show as sold in the seller's closet.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 312 shared tests and 144 server tests that don't need the database (13 new). The 21 new database tests ran on GitHub — **all green ✅**.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: server fixes to buying and the rental steps. Deploy the server and send out the new app build together (an old app would still show "I've returned it" on a sale that is already finished — harmless, just confusing). Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1): the hourly rental clock's reminders, the admin dispute screen with sales in mind, and the remaining dashboard buttons. Or H2 (small tidy-ups).

**Commits:**
- Sales end at "I have it"; purchase requests saved in the full booking shape; rental-step input checked; tests
- Put back six unrelated files the formatter re-wrapped (layout only, no change)
- Decisions and North Star notes; autopilot log for run 43
- GitHub checks on the code push (full set, database tests included): **all green ✅**

---

## 2026-10-25 (run 42, ~3 AM Central) — Editing a look, blocked dates and hand-over photos, made solid

**Plan:** The rest of the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1, taking the three things run 41 pointed at: editing a look, blocking dates on a piece, and (found on the way) the photos taken at drop-off and return. Read each, fix what was wrong, add tests. Also fix whatever turned GitHub's checks red.

**Built / Fixed (what a student or you would notice):**
- **A look you took down stays as it was reported.** Before, a girl could still change the caption of a look you'd removed — so if you later hit "put it back", you'd be restoring words nobody reviewed. Now a taken-down look can't be edited.
- **A look's occasions have to be real ones** (Gameday, Formal…), once each. A tampered app could have put made-up tags under a look, which the feed ranking reads.
- **Blocked dates can no longer get stuck.** If a lender blocked a day and then accepted a rental request for that same day (sent before she blocked it), she could never save her calendar again — every save said "already booked". Now that day is simply handled by the booking.
- **Old blocked days clear themselves**, so years of past days can't fill up her limit of 366.
- **Blocking a day and accepting a rental at the same moment can't both slip through.** Also the "already booked" message now says "Sat, Nov 7" instead of "2026-11-07".
- **Drop-off, return and "problem" photos must be real photos she took in Loane for that rental.** These photos are the only proof in a damage complaint, and you decide complaints by looking at them. Before, a tampered app could send a link to any picture on the internet — or the other girl's own photo — as "proof". The real app already works this way, so nobody notices.
- **Two quick taps on Block no longer show "Something went wrong"** — the second tap now just counts as done. This was what turned GitHub's checks red.

**What to tap to see it:**
- Profile → open a piece → Blocked dates → tap a day → Save. Works as before.
- A rental → record drop-off with a photo → works as before.
- Nothing else looks different.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check, 312 shared tests, and the server tests that don't need the database (17 new ones). The new database tests (rules for editing a look, 4 for blocked dates) ran on GitHub — all green ✅.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: server fixes plus one small database rules change. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1): the rental steps — cancelling, drop-off, return, flagging a problem — and buying a piece (`requestPurchase`) still have no tests of their own.

**Commits:**
- Editing a look and blocking dates: real occasions only, taken-down looks stay as reported, blocked dates saved in one step and never trap her; tests
- Rental photos: drop-off, return and problem photos must be her own uploads for that rental; tests
- Block: a second tap at the same moment counts as done
- Rules test fix; decisions and North Star notes
- Autopilot log for run 42
- GitHub checks on the final code push (full set, database tests included): **all green ✅** (the two pushes before it were red — first the old double-tap Block test, then one rules test still using the phone's clock; both fixed)

---

## 2026-10-25 (run 41, ~2 AM Central) — Reports and blocking, made solid

**Plan:** The rest of the backlog still waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1: read reporting and blocking — safety features Apple cares about, with no tests yet — fix what was wrong, and add tests.

**Built / Fixed (what a student or you would notice):**
- **A report always names the right girl.** The app told the server who was behind a reported comment, review or profile, and the server believed it. Your dashboard's one-click "warn" and "suspend" act on that name — so a tampered app could have got the wrong girl suspended. Now the server looks up who wrote the comment, review, look, piece or message itself.
- **"Report" on someone from inside a chat now works in the dashboard.** Those reports were arriving with no student attached, so you couldn't warn or suspend from them ("This report has no student attached"). Fixed by the same change.
- **Reported comments and reviews keep a copy of the words**, like reported messages already did — so if she deletes the comment before you look, you still see what was said.
- **You can't report your own things**, and junk input gets a clear answer without using up one of her 20 reports a day.
- **Reports can't carry photos for now.** The app never sends any, and there's nowhere in storage for them — so a "photo" could only be a link to any picture on the internet, shown in your dashboard. Noted for when report photos are built.
- **Blocking someone takes the follows off exactly once.** Two quick taps on Block could lower both girls' follower counts twice.
- **A follow can't sneak in at the same instant as a block** and survive it.

**What to tap to see it:**
- Nothing looks different on the phone. Open a chat → "…" → Report → pick a reason → Submit. Then in the dashboard → Reports, that report now shows the student, and Warn/Suspend work on it.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, all 312 shared tests, and the server tests that don't need the database. The 10 new database tests ran on GitHub — all green ✅.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: server fixes to reporting, blocking and following. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1): editing a look, the feature-switch panel, blocked dates on a piece. Or H2 (small tidy-ups).

**Commits:**
- Reports: the server finds who is behind them (not the phone); blocking counts follows down once; tests
- Autopilot log for run 41
- GitHub checks on the code push (full set, database tests included): **all green ✅**

---

## 2026-10-25 (run 40, ~1 AM Central) — Pieces are saved by the server

**Plan:** The rest of the backlog waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run did the "bigger job" run 39 left: move saving a piece (Add to Closet and Edit Listing) onto the server, then check the photos there (H7) and stamp her name on the piece there (H8). Also fix whatever had turned GitHub's checks red.

**Built / Fixed (what a student would notice):**
- **A piece's photos have to be ones she uploaded to Loane.** Before, a tampered app could put any picture from the internet — or another girl's photo — on a piece in Discover. Now the server checks every new photo is in her own folder for that piece. Photos already on a piece are kept as they are, so older pieces (and the made-up seed pieces) still edit fine.
- **Her name and photo on a piece always match her profile.** The app used to write its own copy and nothing checked it, so a piece could be shown under someone else's name. Now the server copies it from her profile every time she saves — editing a piece also refreshes it.
- **One set of rules for a good piece.** The server runs the exact same checks as the form (prices, photos, occasions, sizes). The old database copy had drifted — it never required a 1-day price, which the form always did.
- **Editing a piece no longer touches things the form doesn't show** — her blocked dates, saves count, same-day premium. Before, an edit could quietly overwrite blocked dates she'd just changed on another screen.
- Still 60 new pieces an hour at most; edits don't count.
- **Fixed: deleting a look with a quick double-tap could show "Something went wrong"** even though the look was deleted. Now the second tap just counts as done. This was the one thing turning GitHub's checks red since last run.

**What to tap to see it:**
- Nothing looks different. Profile → + → Add to My Closet → add a piece → it saves as before. Then open it → Edit → change the name → Save; it saves as before.
- Profile → open one of your looks → "…" → Delete, tapping twice quickly → no error.

**Skipped / blocked:**
- The overnight machine still can't start the test database. Passed here: type checks, lint, the index check, 312 shared tests, and the server tests that don't need the database (including 14 new ones for the piece checks). The database tests — including 17 new ones for saving pieces and 8 for the updated database rules — run on GitHub: **all green** (565 server tests, with the database).
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- When you next deploy: server and database rules go out together, and use the new app build after (see the list at the top). Nothing to decide.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1): editing a look, the feature-switch panel, blocked dates. Or H2 (small lint/TODO tidy-ups).

**Commits:**
- Pieces are saved by the server: photos must be her own uploads, her name comes from her profile
- Docs: pieces saved by writeListing (decisions, audits)
- Deleting a look: a second tap at the same moment no longer shows "Something went wrong"

---

## 2026-10-25 (run 39, ~midnight Central) — Profile photos must be her own

**Plan:** The backlog is still waiting on you (F7), on payments (B8) or on a real phone (G8, H5). So this run took H7: make sure a piece's photos and a profile photo are files she actually uploaded to Loane (looks got this in run 38), in the database rules, with tests.

**Built / Fixed (what a student would notice):**
- **A profile photo has to be one she uploaded to Loane.** Before, a tampered app could set her profile picture to any picture on the internet, or to another girl's photo — and it shows next to her name everywhere (feed, comments, chats). Now it must be a file in her own folder in Loane's storage. The real app already works this way, so nobody notices. An old photo never stops her editing her bio.

**What to tap to see it:**
- Nothing looks different — Profile → Edit Profile → change your photo; it works as before.

**Skipped / blocked:**
- **Piece photos: built, then taken back out.** The same check for a piece's photos worked in every test except a piece with all 8 photos plus a "Try it on" photo — the database's rule checker has a hard limit on how much work one save may do, and that piece went over it, even after three slimmer rewrites. Shipping it would have broken Add to Closet for anyone using 8 photos, so I removed it. The right fix is to save pieces through the server (the way looks are saved), where there's no such limit — that's a bigger job, left on the backlog (H7) for a future run.
- The overnight machine still can't start the test database. Passed here: type checks, lint, the index check, 312 shared tests, 102 server tests that don't need the database. The database tests run on GitHub — result below.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** H7 the proper way — move saving a piece into a server function, then add the photo check there (and stamp her name/photo on the piece, H8). Or keep sweeping untested server code (H1): editing a look, the feature-switch panel.

**Commits:**
- Pieces and profile photos: every new photo must be her own upload (first try)
- Three tries at making the piece check fit the database's limit (didn't fit)
- Profile photo must be her own upload; piece-photo check taken back out; tests
- Autopilot log for run 39
- GitHub checks on the final code push (full set, database tests included): **all green ✅** (the three in-between pushes were red on the one 8-photo test — that is why the piece check came out)

---

## 2026-10-25 (run 38, ~11 PM Central) — Posting and deleting a look, made solid

**Plan:** The backlog is still waiting on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1: read posting a look, deleting a look, and the timer that puts scheduled looks up — none had tests — fix what was wrong, and add tests.

**Built / Fixed (what a student would notice):**
- **Every photo in a look has to be one she actually uploaded to Loane.** Before, a tampered app could post a look whose "photo" was a link to any picture on the internet, or a photo from another girl's folder — and her whole campus would see it, with none of our photo safety checks ever running. Now each photo must be in her own folder in Loane's storage, and the link must be that exact file. The real app already works this way, so nobody notices.
- **Odd photo sizes can't break the feed.** A zero, negative or nonsense size on a photo would have broken that look on everyone's phone. Refused now.
- **Deleting a look counts down exactly once.** A double-tap on Delete could lower her post count (and the "seen in looks" count on each tagged piece) twice. Now it happens once.
- **Deleting a look always works.** If a piece tagged in it had been fully deleted (e.g. the account behind it was deleted), deleting the look failed with "something went wrong". Fixed.
- **Scheduled looks always go up on time.** The timer only looked at the first 100 scheduled looks — if 100 looks were booked for later, one due now could sit waiting forever. It now checks all of them.
- **A deleted look can't come back.** If she deleted a scheduled look (or an admin took it down) at the exact moment the timer ran, the timer could put it back on the feed. Now it only publishes a look nobody has touched since it checked.
- **Junk input gets a clear answer** instead of a crash, and a broken post no longer uses up one of her hourly posts. Repeating an occasion twice now counts once in For You.

**What to tap to see it:**
- Nothing looks different — post a look, schedule one, delete one; it all works as before.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (86 searches, none missing), all 312 shared tests, and the 106 server tests that don't need the database (9 new). The 12 new database tests ran on GitHub — all green ✅.
- Noticed, left alone: pieces (unlike looks) are saved straight from the phone, so a piece's photo link isn't checked the same way. Moving that check onto pieces and profile photos is a bigger change to the database rules — added as a suggestion (H7).
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1) — editing a look and the admin feature-switch panel — plus H2 (small cleanups), or H7.

**Commits:**
- Posting a look: every photo must be her own upload to Loane; junk input gets a clear answer; tests
- Deleting a look gives counts back exactly once; scheduled looks past the first 100 go up, and a deleted one never comes back; tests
- Autopilot log for run 38
- GitHub checks on the code push (full set, database tests included): **553 passed, 0 failed ✅**

---

## 2026-10-25 (run 37, ~10 PM Central) — The dashboard's moderation buttons can't undo the wrong thing

**Plan:** The backlog is still waiting on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1: read the dashboard's take-down, suspend and "decide a disputed return" buttons — none had tests — fix what was wrong, and add tests.

**Built / Fixed (what you'd notice in the dashboard):**
- **"Put it back" returns a piece to what it was.** It always made the piece available again. So a SOLD piece that was reported, taken down and put back came back up for rent and sale — it could have been sold twice. Now sold stays sold, paused stays paused, and a scheduled look stays scheduled.
- **You can't take down something its owner already deleted.** Doing so meant "Put it back" could bring a look or piece she'd deleted back to life. The button is greyed out on those now, and a report about one just closes.
- **A deleted account can't be brought back by accident.** Suspending a "Deleted account" and then lifting the suspension turned it back into a live account. Now deleted accounts can't be suspended or warned, and "Lift suspension" only works on someone who's actually suspended.
- **No double counting when two people click at once.** Two admins (or one double-click) deciding the same disputed return added the rental to both girls' histories twice. Same for taking down a comment (the count under the look dropped by two). Each now happens exactly once.
- **Small dashboard tidy-ups:** the Listings page now says "Put it back" on a taken-down piece (it always said "Hide listing"), and the Suspend button at the top of a student's page — greyed out with "Needs a Cloud Function" for weeks — now works.
- **Junk input gets a clear answer** instead of a vague "something went wrong", on all of these.

**What to tap to see it:**
- Admin dashboard → **Listings** → a piece that's been taken down now shows **Put it back**. Users → a student → the **Suspend** button at the top now opens the same box as the one in Moderation.
- Nothing changes on the phone.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (86 searches, none missing), all 312 shared tests (7 new), and the server tests that don't need the database. The 23 new database tests (16 for take-downs and suspending, 3 for reports, 4 for disputes) ran on GitHub — all green ✅.
- One thing noticed and left alone: a suspension can carry an "until" date, but nothing lifts it on its own yet (the dashboard doesn't offer the date either). Noted in `docs/decisions.md`; building the automatic lift is small if you ever want it.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1) — creating and deleting a look, and the admin feature-switch panel — plus H2 (small cleanups).

**Commits:**
- Dashboard: putting a piece or look back returns it to what it was (sold stays sold); deleted accounts can't be suspended or revived; tests
- Dashboard: deciding a disputed return can't count the rental twice when two admins click at once; junk input gets a clear answer; tests
- Autopilot log for run 37
- GitHub checks on the code push (full set, database tests included): **534 passed, 0 failed ✅**

---

## 2026-10-24 (run 36, ~6 AM Central) — Sharing into chats respects blocks

**Plan:** The backlog is still waiting on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1: read sharing a look, piece or profile into a chat, and the dashboard's "resolve" button for Contact us messages — none had tests — fix what was wrong, and add tests.

**Built / Fixed (what a student would notice):**
- **A share can't get around a block.** If Ella blocked Kate, a friend could still send Kate one of Ella's looks or pieces in a chat — putting Ella's closet in front of the one person she blocked. Now Kate is quietly skipped (the friend just sees it went to everyone else). Profiles already worked this way for the sender, but not for the people receiving it — fixed too.
- **You can't share something from a girl you have a block with.** Sharing her look or piece now answers "That look is gone" / "That piece is gone" — the same words as a deleted one, so nobody finds out about a block this way.
- **Junk input gets a clear answer.** A broken or tampered request to share, or to close a Contact us message in the dashboard, now gets a plain message instead of a vague "something went wrong". This also covers the note box on every admin action.

**What to tap to see it:**
- Mostly invisible. To try it: on a look, tap the share arrow → pick friends → Send. Works exactly as before for everyone without a block.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (86 searches, none missing), all 305 shared tests, and the server tests that don't need the database. The 19 new database tests (15 for sharing, 4 for closing Contact us messages) ran on GitHub — all green ✅.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1) — the remaining admin tools (taking content down, suspending, disputes) and creating/deleting a look — plus H2 (small cleanups).

**Commits:**
- Sharing into chats: never puts a look, piece or profile in front of someone with a block with its owner, and never across her own block; tests
- Dashboard: closing a Contact us message (and every admin note) gives junk input a clear answer instead of a crash; tests
- Autopilot log for run 36
- GitHub checks on the code push (full set, database tests included): **511 passed, 0 failed ✅**

---

## 2026-10-24 (run 35, ~5 AM Central) — Chats, removing a piece, and Contact us tightened up

**Plan:** The backlog is still waiting on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1: read starting a chat, removing a piece, and the Contact us form in Help — none had tests — fix what was wrong, and add tests.

**Built / Fixed (what a student would notice):**
- **No new chats with deleted or suspended accounts.** You could start a brand-new chat with a "Deleted account" or a suspended girl from an old screen. Now it says "We could not find that student" — the same rule as following. A chat you *already had* with her still opens, so a renter whose lender gets suspended mid-rental can still scroll back to where they agreed to meet.
- **A chat can only be "about" your own piece or rental.** Someone with a script could pin a stranger's rental or another girl's dress onto a chat. Now anything that doesn't belong to the two of you is quietly ignored, and the chat still opens normally.
- **Removing a piece can't clash with a new request.** If a renter asked for a piece in the same split second its owner removed it, the request could slip through — leaving a girl waiting on a piece nobody can see. Now one always goes first and the other gets a clear answer.
- **Contact us can't be flooded.** It had no cap, so a script could fill the help queue you read by hand. Now ten messages a day — a girl with a real problem never notices. A message that's refused for a typo doesn't use one up.

**What to tap to see it:**
- Mostly invisible. Contact us: **Profile → ☰ → Help → Contact us**, send a message — works exactly as before.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (86 searches, none missing), all 305 shared tests, and the server tests that don't need the database. The 19 new database tests (8 chats, 8 removing a piece, 3 Contact us) ran on GitHub — all green ✅.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1) — sharing a look/piece/profile into chats, and the admin support-request tools — plus H2 (small cleanups).

**Commits:**
- Chats: no new chat with a deleted or suspended account, and a chat can only be about your own piece or rental; tests
- Removing a piece can't race a new rental request; Contact us is capped at ten a day; tests
- Autopilot log for run 35
- GitHub checks on the code push (full set, database tests included): **492 passed, 0 failed ✅**

---

## 2026-10-24 (run 34, ~4 AM Central) — Contacts and suggested closets tightened up

**Plan:** The backlog is still waiting on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1: read "find friends from your contacts" and "suggested closets" (the Follow-3-closets step), which had no tests, fix what was wrong, and add tests.

**Built / Fixed (what a student would notice):**
- **Someone who blocked you never shows up in your contacts.** If a girl had blocked you, you could still find her by having her number in your phone. Now she stays hidden, the same as everywhere else.
- **Nobody can use "find friends" to guess phone numbers.** It could be called over and over with made-up numbers, which would let a script work out which numbers belong to girls at USC. Now it's capped at 40 checks a day — that's three full checks of a phone with 3,000 contacts, so a real student never notices. If she somehow does: "You have checked your contacts a few times today. Try again tomorrow."
- **Suggested closets are USC girls only.** A friend-of-a-friend at another school (say, Clemson) could be suggested to follow, even though you could never borrow from her. Now only your own campus.
- **The suggestion row stays full.** If a suggested girl had been suspended or had blocked you, she was quietly removed and the row came back one short. Now the next girl in line fills her spot.

**What to tap to see it:**
- Mostly invisible. To see contacts: **Profile → ☰ → Find Friends** (needs a friend whose number you have, signed up with that number in Settings). Suggestions: the **Follow 3 closets** step in Get started after creating an account.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (86 searches, none missing), all 305 shared tests, and the server tests that don't need the database (1 new). The 14 new database tests (9 for contacts, 5 for suggestions) run on GitHub — all green on GitHub ✅.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1) — starting chats, removing a listing, and the support/contact form — plus H2 (small cleanups).

**Commits:**
- Contacts: someone who blocked you never shows up, and nobody can check numbers all day; tests
- Suggested closets: same campus only, the row stays full when someone drops out, and a strange limit can't break it; tests
- Autopilot log for run 34
- GitHub checks on the code push (full set, database tests included): **473 passed, 0 failed ✅**

---

## 2026-10-24 (run 33, ~3 AM Central) — When a piece sells, nobody is left waiting

**Plan:** H6 from the backlog — when a lender says yes to a buyer, tell everyone else still waiting straight away. Then keep up H1: read the hourly rental clock (the server job that times out requests and closes finished rentals), which had no tests, fix what's wrong, and add tests.

**Built / Fixed (what a student would notice):**
- **"That piece was sold" — straight away.** The moment a lender says yes to a buyer, every other girl with an open request for that piece (buyers and renters) is told it was sold, and her request shows "Sold to someone else". Before, she waited up to a day for it to time out, for a piece that was already gone.
- **No more asking to rent a piece that's being sold.** A sale has no dates, so the date check used to let a new rental request through — and the lender could never accept it. Now she sees "That piece is being sold to someone else" right away.
- **The rental clock can't undo a yes.** Once an hour, the server times out unanswered requests and closes rentals nobody complained about. If the lender said yes (or the renter reported a problem with the return) in the same second the clock ran, the clock could overwrite it — turning a confirmed rental into "Request expired", or burying a complaint. Now the clock double-checks each one at the moment it writes.
- Saying yes to a **rental** still leaves the other requests alone: a buyer can have the piece once it's back.

**What to tap to see it:**
- Put a piece up for both rent and sale → have two friends tap **Become the owner** → **Profile → Rental requests** → accept one. The other friend gets an alert "That piece was sold", and her request page says "Sold to someone else".

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (86 searches, none missing), all 305 shared tests, and 11 new tests that don't need the database. The 10 new database tests (selling, and the hourly clock) ran on GitHub with the full test set on both code pushes: **all green ✅**.
- If a sale is later cancelled, the girls who were told "sold" aren't reopened — they'd ask again. Rare; written down in `docs/decisions.md`.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code (H1) — contact matching and suggested closets — plus H2 (small cleanups).

**Commits:**
- Bookings: when a piece sells, everyone else still waiting hears straight away, and nobody new can ask to rent it; tests
- Rental clock: the hourly sweep can't undo a yes, a cancel or a complaint that lands at the same moment; tests
- Autopilot log for run 33

---

## 2026-10-24 (run 32, ~2 AM Central) — A piece can't be sold twice, plus comment fixes

**Plan:** The backlog is still waiting on you (F7), on payments (B8) or on a real phone (G8, H5). So this run kept up H1/H2: read the comments, comment hearts and "after a request" rental steps, which had few or no tests, fix what was wrong, and add tests.

**Built / Fixed (what a student would notice):**
- **A piece can't be promised twice any more.** When a lender said yes, we only compared dates, and a sale has no dates. So she could say yes to two buyers for the same top, sell a dress a renter was already confirmed for, or rent out something she'd already sold. Now she sees a clear "no": "You already agreed to sell this piece to someone else", "It's on Loane until Tue, Nov 3, so you can't sell it yet", or "That piece has already been sold". Same rule as when a buyer first asks: whoever was promised first wins.
- **No hearts on comments under a look that's gone.** If a look was deleted or taken down, an old screen could still heart its comments and send the writer an alert for a look nobody can open. Now it says "That look is gone." Taking a heart back always works.
- **Deleting a comment twice at once can't throw the count off.** If she and the look's owner both deleted the same comment at the same moment, the comment count went down by two. Now it goes down once, and never below zero.
- **Limits on what goes on a rental page.** A reason, a handoff note or a return-problem note is capped at 500 characters, and at most 8 photos. The app already uses ready-made reasons, so nobody will notice — it only stops someone with a script. Blocked calendar days must be real dates, up to a year's worth.

**What to tap to see it:**
- Mostly invisible. To see the main one: put a piece up for both rent and sale → have two friends tap **Become the owner** → go to **Profile → Rental requests** → accept the first → try to accept the second. It now says you already agreed to sell it.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (85 searches, none missing), all 305 shared tests, 16 new "can she say yes?" tests, and the server tests that don't need the database. The 10 new database tests for comments and hearts ran on GitHub with the full test set on both code pushes: **all green ✅**.
- When a piece sells, the other girls still waiting on a request aren't told straight away — their request times out as before. Added as a suggestion (H6).
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** H6 (tell waiting requests when a piece sells), then keep sweeping untested server code — contact matching, suggested closets and the hourly booking sweep.

**Commits:**
- Comments: no hearts under a look that's gone, and a double delete can't take the count down twice; tests
- Bookings: a lender can't say yes to two buyers, sell a piece someone has rented, or rent out a sold one; tests
- Rentals: cap the words and photos on a rental, and only real dates can be blocked on a calendar
- Autopilot log for run 32

---

## 2026-10-24 (run 31, ~1 AM Central) — Four small fixes in following, likes, saves and usernames

**Plan:** Same as run 30 — everything left in the backlog waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run is H1/H2: read the server code for following, likes, saves and changing a username, which had no tests, fix what's wrong, and add tests.

**Built / Fixed (what a student would notice):**
- **A "started following you" alert always opens the right girl.** It used to open her by the @username she had that day — if she renamed herself later, tapping the alert said "Closet not found", or opened whoever took her old name. Same fix as shared profile cards got in run 28.
- **Nobody can follow a deleted or suspended account.** An old profile or feed card could still show the Follow button; the follow counted and the "Deleted account" got an alert nobody would read. Unfollowing them still works, so she can tidy her list.
- **No likes or saves on a look or piece that's gone.** A phone still showing an old card could like a deleted or taken-down look (and send its owner an alert for a look nobody can open), or save a deleted piece into her Saved list. Now it says "That post is gone" / "That piece is no longer listed". Paused and sold pieces can still be saved. Un-liking and un-saving always work.
- **Changing your username twice quickly can't jam a name.** Two changes sent close together (a double tap, or two phones) could leave the in-between name locked to her forever, so nobody could ever use it. Fixed.
- **Ten username changes a day, at most.** Nobody real needs more; it stops a script from grabbing lots of names. She sees "You have changed your username a lot today. Try again tomorrow."

**What to tap to see it:**
- Mostly invisible. To see the alert fix: have a friend follow you → she changes her username (Profile → Edit Profile) → you go to **Activity** → tap "@… followed you". It opens her profile, not "Closet not found".

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (85 searches, none missing), all 305 shared tests (1 new), and the server tests that don't need the database. The new database tests — 9 for following, 7 for usernames, 15 for likes and saves — ran on GitHub on the final code push, with the full test set: **all green ✅**.
- One file (contact matching) got a whitespace-only tidy from the code formatter. No change in what it does.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping untested server code — comment hearts, contact matching, suggested closets, and the booking steps after a request — for bugs like tonight's, with tests.

**Commits:**
- Activity: a new-follower alert still opens the right closet after she changes her username
- Follows: nobody new can follow a deleted or suspended account; tests for following
- Usernames: a quick double change can't leave an old name locked forever, and ten changes a day at most
- Likes and saves: nothing new lands on a deleted or taken-down look or piece, but taking one back always works; tests
- Autopilot log for run 31

---

## 2026-10-24 (run 30, ~midnight Central) — Two hidden bugs fixed: sign-ups on campus wifi, and star ratings

**Plan:** Everything left in the backlog waits on you (F7), on payments (B8) or on a real phone (G8, H5). So this run is H1/H2: read the server code nobody had tested yet, looking for real bugs, fix them, and add tests.

**Built / Fixed (what a student would notice):**
- **Signing up on campus wifi no longer gets girls turned away.** Sign-ups are limited per internet address, not per person — and on campus wifi, a whole building shares a few addresses. The limit was 5 an hour, so at a launch table on Greene Street the sixth girl in line would have seen "Too many sign-ups from here". Now it's 30 an hour, which still stops anyone making fake accounts by the thousand.
- **A rare sign-up lockout for the whole world is gone.** If Google ever stopped telling us someone's address, every sign-up anywhere would have shared one bucket of 5 an hour. The code's own note said this shouldn't happen; it did anyway. Fixed.
- **Star ratings stay exact.** Each new review nudged the stored average using an already-rounded number, so tiny errors built up over time. Now every new or edited review recounts her stars from the reviews themselves — the same way an admin takedown already did.
- **A review an admin took down can't be quietly rewritten.** Before, the writer could still edit it (within 48 hours), which also shifted the lender's stars even though that review no longer counted. Now she sees "This review was taken down, so it cannot be changed."

**What to tap to see it:**
- Nothing looks different day to day. To see the review fix: as a renter, finish a rental → leave a review → the lender's profile shows the stars. (The takedown case needs the admin dashboard → Reviews → hide it, then try editing it on the phone.)

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (85 searches, none missing), all 304 shared tests (5 new), and the server tests that don't need the database (7 new). **GitHub ran the full set, database tests included (8 new ones for writing and editing reviews), on both of tonight's pushes: all green ✅.**
- Known limit, written down for later (Phase 8, App Check): someone with a script can still fake their address to dodge the sign-up limit. Fixing it properly needs App Check, not a guess about Google's internals.
- B8 still waits on payments; F7 on your decision; G8 and H5 need a real phone.

**🚨 NEEDS ZACK:**
- Nothing urgent. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** Keep sweeping the untested server code (follows, saves, shares, changing a username) for bugs like tonight's, with tests for each.

**Commits:**
- Sign-ups: room for a campus wifi crowd, and a missing address no longer locks out everyone
- Reviews: stars are counted from the reviews themselves, and a taken-down review can't be rewritten
- Autopilot log for run 30

---

## 2026-10-24 (run 29, ~11 PM Central) — Smoother feed, Discover and chats

**Plan:** H3 (speed). Check every small photo uses the small copy; then stop the busiest screens — the feed, Discover's grid and chats — from re-drawing every card when only one thing changed. B8 still waits on payments, F7 on your decision, G8 needs a real phone. H2: no warnings, and every leftover note in the code is a future-phase job, so nothing to do.

**Built (what a student would feel, not see):**
- **The feed scrolls smoother.** Before, one like anywhere on campus, or a new page loading, made the phone re-draw every look it was holding (up to ~15, each with its photos). Now only the look that changed re-draws.
- **Discover's grid stays snappy while she types or filters.** Every letter in the search box used to re-draw every piece on screen; now unchanged pieces are skipped. A save on one piece no longer re-draws all the others either.
- **Typing in a long chat no longer lags.** Each letter used to re-draw every message in the thread. Now only the message box changes; a new message or heart re-draws just that one bubble.
- Photos: checked every small photo in the app — all already use the small, quick-loading copy where one exists. Nothing to change.

**What to tap to see it:**
- Nothing looks different — it should just *feel* quicker, most on an older iPhone. Try: Feed → scroll fast; Discover → type in search; Messages → a long chat → type quickly.

**Fixed:**
- The extra re-drawing above. No broken features found.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint (with the text-size check), the index check (84 searches, none missing), all 299 shared tests. No server code or database rules changed tonight; GitHub runs the full set on the push.
- I couldn't feel the speed-up on a real phone — added as H5 for a 1-minute check by you.
- Profiles, Activity and the inbox didn't get this treatment — their lists are short enough that it would add code without a difference you'd feel. Written down in `docs/decisions.md`.
- B8 (Venmo words) still waits on payments; F7 still waits on your decision; G8 needs a phone.

**🚨 NEEDS ZACK:**
- Nothing new. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** The founder backlog is now done except items waiting on you (F7), on payments (B8) or on a real phone (G8, H5). Next runs: H1/H2 sweeps (tests for anything untested, small fixes), and new *(suggested)* polish ideas.

**Commits:**
- Feed: a card only re-draws when its own look changes, so scrolling stays smooth
- Discover: grid cards skip re-drawing while she types or filters unless their piece changed
- Feed and Discover: a like or save on one piece no longer re-draws every card on screen
- Chat: typing no longer re-draws every message in the thread
- Autopilot log for run 29; H3 done

---

## 2026-10-24 (run 28, ~10 PM Central) — Shared profile cards survive a rename; other schools' sign-ups in the dashboard

**Plan:** E15 first (a shared profile card opens by @username, so it breaks if she renames herself — open it by her account instead). Then F11 (show how many students from other schools have signed up, in the dashboard). B8 still waits on payments; F7 still waits on your decision; then H3 if time allows.

**Built:**
- **A profile card sent in a chat always opens the right person**, even if she changes her @username later. Before, an old card would say "Closet not found" — or, worse, open whoever took her old @name.
- **Dashboard → Campuses → "Sign-ups from other schools".** A list of every school outside South Carolina that students have signed up from, biggest first, with a total ("7 students from 3 other schools"). When there are none it says so. This is the number to watch when picking the next campus, and it helps with your F7 decision (keep letting any .edu in, or USC-only with a waitlist).

**What to tap to see it:**
- Phone: someone's profile → **…** → **Share profile** → send it to a friend → open that chat → tap the card. It opens her profile (same as before — the difference only shows after a rename).
- Dashboard: sign in → **Campuses** → the new panel at the top. With the seeded data it says "None yet", because every seeded student is at South Carolina.

**Fixed:**
- The shared-profile rename problem above. Nothing else broken found.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (84 searches, none missing), all 299 shared tests (4 new), and the server tests that don't need the database. No server code or database rules changed tonight, so the database tests have nothing new to check; GitHub runs the full set on the push.
- B8 (Venmo words) still waits on payments; F7 still waits on your decision.

**🚨 NEEDS ZACK:**
- Nothing new. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in. The new Campuses panel shows how many students that would affect.

**Next up:** H3 (speed checks — photo sizes and screens redrawing more than they need), then H1/H2 sweeps.

**Commits:**
- Shared profile cards open by account, so they still work after she changes her username
- Dashboard: Campuses shows sign-ups from other schools, most first, to pick the next campus
- Autopilot log for run 28

---

## 2026-10-23 (run 27, ~6 AM Central) — Share a profile in a DM, hold-to-preview on Discover

**Plan:** H2 (small fixes) first — but there were no warnings and every leftover note in the code is a future-phase job (payments, email confirmation), so nothing to do there. Then E11 and E12 (both need a new tracked action added to the database rules), then E13 ("Share profile"). B8 still waits on payments; F7 still waits on your decision.

**Built:**
- **Share a profile in a DM.** Like sharing a look: pick friends, add a note, send. It lands in the chat as a card — her photo, name, @username and how many pieces are in her closet — and tapping it opens her profile. Great for "you HAVE to see her closet", and for a lender sending her own closet to her friends.
  - The card is made by the server, so nobody can fake one (a card that says @ella always opens Ella).
  - Suspended, deleted or blocked accounts can't be shared, and it never gives away that someone blocked you.
  - Inbox preview says "Sent a profile"; replying to one quotes "A profile".
- **Press and hold a piece on Discover** to see it big — the same preview card profiles already had. Tap it to open, tap outside to close.
- **Two new things we now count** (nothing she sees): every press-and-hold preview, and every heart on a comment. Useful for seeing what catches eyes before girls commit to opening something.

**What to tap to see it:**
- Someone's profile → **…** (top right) → **Share profile** → pick a friend → Send. Open that chat → the profile card → tap it.
- Your own profile → **☰** (top left) → **Share My Profile**.
- Discover → **press and hold** any piece → big preview → tap it to open.

**Fixed:**
- Nothing broken found tonight.
- One thing I caught before it shipped: the reply quote's new "was this a profile?" note would have made **every reply fail** if the app update reached phones before the database rules were deployed. Now that note is only added when it's actually a profile, so old rules accept replies as before.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (84 searches, none missing), all 295 shared tests (4 new), the server tests that don't need the database. **GitHub ran the full set, database tests included (4 new), on both of tonight's pushes: all green ✅.**
- Didn't put a share button in your own profile's top bar: with three icons on the right, your @name in the middle would get cut off. It's in the ☰ menu instead.
- Small known limit, added to the backlog (E15): a profile card opens by @username, so an old card breaks if she changes her username.
- B8 (Venmo words) still waits on payments; F7 still waits on your decision.

**🚨 NEEDS ZACK:**
- When you next deploy: the new `shareProfile` function and the database rules go out together with (or before) the app update. Normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** E15 (open a shared profile card by account, not @username), then F11 (count other schools' sign-ups in the dashboard — pairs with your F7 decision), then H3 (speed checks).

**Commits:**
- Discover: press and hold a piece to preview it; previews and comment hearts are now counted
- Share profile: send someone's closet (or your own) into a DM as a card
- Autopilot log for run 27

---

## 2026-10-23 (run 26, ~5 AM Central) — Messages scrolls past 50 chats, a size check, offline lists finished

**Plan:** Next up from run 25 was E10, G6, G7, in that order. E10: page the Messages inbox, giving the unread badge its own list first so scrolling can't change it. G6: an automatic check so no new screen forgets the text-size cap. G7: the "Couldn't load" offline rule for the lists run 24 didn't reach.

**Built:**
- **Messages no longer stops at 50 chats.** Scroll to the bottom and the next 50 load (small spinner at the bottom). Everything on screen stays live — a new message still jumps its chat to the top.
- **The red Messages badge has its own list** (her 50 most recently active chats), so scrolling the inbox never changes the number. Anything that makes a chat unread also moves it to the top, so 50 is plenty.
- **Search in Messages:** if it finds nobody in the chats loaded so far and there are older ones, it offers **"Search older chats"** instead of just saying "nobody". Message requests offers **"Look further back"** the same way.
- **An automatic size check** (nothing a student sees): the checks now fail if any screen draws text that ignores the iPhone Text Size cap. GitHub runs it on every push.

**What to tap to see it:**
- Messages → scroll to the bottom (you need more than 50 chats to see more load — the seeded accounts have fewer, so it looks the same as before).
- Messages → search a name that isn't there → "Nobody by that name" (with "Search older chats" if you have over 50 chats).
- Airplane Mode → Profile → Followers, Saved, Liked, Reviews, or Help → past reports → "Couldn't load… Try again" instead of "nothing here yet".

**Fixed:**
- With no signal, Followers/Following, Saved, Liked, Reviews and Help's past reports said "nothing yet" — as if she had none. They now say they couldn't load, with Try again.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint (with the new size check), the index check (84 searches, none missing), all 291 shared tests (1 new). No server code or database rules changed tonight. **GitHub ran the full set on tonight's final push, database tests included: all green ✅.**
- B8 (Venmo words) still waits on payments; F7 still waits on your decision.

**🚨 NEEDS ZACK:**
- Nothing new. Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** H — tests and tidy-ups (H2: small TODOs and warnings), then E11/E12 (they need a database rules change, so best on a run where GitHub's database tests can check them).

**Commits:**
- Messages: the inbox loads 50 chats at a time as she scrolls instead of stopping at 50
- Lint: fail when a screen uses React Native's own Text or TextInput without the text-size cap
- Offline: followers, saved, liked, reviews and Help's past reports say 'Couldn't load' instead of a false 'nothing yet'

---

## 2026-10-23 (run 25, ~4 AM Central) — Delete an account from the dashboard, "Discard this look?", a "My size" chip

**Plan:** Section H's tests and tidy-ups have no single next task, so I took the highest finished-in-one-sitting suggestions instead, top to bottom: C11 (admin "Delete this account"), then E14 ("Discard?" on the new look and new piece screens), then F10 (a "My size" chip on Discover). B8 still waits on payments, E10 needs a bigger change to the unread badge first, and F7 waits on your decision.

**Built:**
- **Dashboard: "Delete this account".** For when a girl emails asking to be deleted but can't do it in the app (lost phone, can't sign in). It does exactly what her own "Delete my account" does — same steps, shared — so the two can never promise different things. To stop a slip on the wrong page you must give a reason AND type her @username. It won't delete an admin or yourself, and it refuses while she has a rental going. Every deletion is written in the audit log.
- **"Discard this look?"** If she has picked photos for a new look and backs out, she's asked first instead of losing her photos, crops, tags and caption. Once she taps Share, nothing asks.
- **"Discard this piece?"** Same on Add to Closet and on "Add a piece" from tagging — but only once she has actually typed or added something.
- **A "My size" chip on Discover** — first in the row before Gameday, Going Out and the rest. One tap shows only pieces that fit her. It only appears once she has a size on her profile.

**What to tap to see it:**
- Dashboard → Users → pick a student → **Delete this account** → type a reason and her @username → Delete for good. (Try it on the emulator, not on a real student.)
- App → + → Post a Look → pick a photo → tap back → "Discard this look?"
- App → + → Add to My Closet → type a name → tap back → "Discard this piece?"
- App → Discover → the **My size** chip at the front of the row (add a size first in Edit Profile if you don't see it).

**Fixed:**
- On a student's page in the dashboard, every pop-up (Suspend, Add a note, Export her data) showed a stray line of code and a "How many" box that only belonged to Give free try-ons. Now that box only shows for try-ons.

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed here: type checks, lint, the index check (84 searches, none missing), all 290 shared tests, the server tests that don't need the database, and the dashboard build. **GitHub ran the full set on the "Delete this account" push, database tests included (6 new): all green ✅.**
- No database rules changed tonight.

**🚨 NEEDS ZACK:**
- When you next deploy: one new server function (`adminDeleteAccount`) — normal deploy, nothing to switch on.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** E10 (page the Messages inbox past 50 chats — first move the unread badge off that list), G6 (a lint check for text that ignores the size cap), G7 (the offline rule for the remaining lists).

**Commits:**
- Dashboard: 'Delete this account' for privacy requests, using the same steps as her own button
- New look and new piece: ask 'Discard this look?' / 'Discard this piece?' before throwing her work away
- Discover: a 'My size' chip at the front of the occasions row, one tap instead of opening Filter

---

## 2026-10-23 (run 24, ~3 AM Central) — Loane behaves when the signal drops

**Plan:** G3 — no crashes or confusion with no internet, slow internet, or deleted posts/accounts. First find what actually goes wrong offline, then fix the worst first: anything that misleads her (wrong screen, "not found", "nothing yet") and anything that spins forever. Then start H (tidy-ups and speed).

**Built:**
- **A "No internet connection" bar.** A small dark bar floats just above the tabs whenever the phone has no signal, and disappears when it's back. It never blocks a tap.
- **Saves don't spin forever any more.** Before, with no signal, saving a piece, editing a look or profile, uploading a photo, or sending a message just... waited. The button stayed grey and her message vanished from the box. Now she's told straight away "No internet connection. Check your signal and try again." and **what she typed stays in the box.**
- **Slow signal:** a photo upload now gives up after 1 minute and says so (it used to keep trying for 10 minutes behind a spinner).

**What to tap to see it:**
- Turn on **Airplane Mode** → open Loane → the bar shows near the bottom. You stay signed in.
- Still in Airplane Mode: Messages → open a chat → type something → send → "No internet connection… Your message is still in the box."
- Open a look or a piece from your profile → "Couldn't load… Try again" (not "This look isn't here"). Turn Airplane Mode off → tap Try again → it loads.

**Fixed:**
- **The big one: opening Loane with no signal sent signed-in students to the "create account" screen.** The app asked for her profile, got "nothing" from the phone's empty memory, and believed it. Now it waits for the real answer.
- With no signal, a look, a piece, a rental or a chat could say "not found" or "isn't here", and Messages, Activity, My Rentals, the feed and comments could say "nothing yet". They now say "Couldn't load — Try again", which is the truth.
- Deleted posts and deleted accounts: checked — earlier runs already handle these ("not found" screens, and a "Deleted account" name everywhere instead of a crash). Nothing to fix.
- Two old notes in the code said blocking and some server features were "not built yet" — they are. Notes corrected; nothing a student sees changed.
- The small piece photo on a rental page now loads the small copy of the photo, not the full-size one (faster, less data).

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download is blocked here). Passed: type checks, lint, formatting, the index check (84 searches, none missing), all 290 shared tests (7 new), the server tests that don't need the database, and the iPhone app build. **No server code or database rules changed tonight**, so the database tests have nothing new to catch. **GitHub ran the full set, database tests included, on tonight's push: all green ✅.**
- Nobody can turn on Airplane Mode on a phone from here, so the offline behaviour is checked by reading the code, not by hand — see NEEDS ZACK.
- One new free building block was added to the app (the standard Expo tool for "is the phone online?"). It already works in Expo Go — no new app build needed.

**🚨 NEEDS ZACK:**
- Try Airplane Mode once (steps above) and tell me if anything looks off.
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.

**Next up:** H — tests and tidy-ups, then the rest of the speed work (H3). Then the suggested items.

**Commits:**
- No signal no longer means 'not found': opening Loane offline kept her signed in instead of sending her to create an account
- Offline: a 'No internet connection' bar, and saves, uploads and messages say so at once instead of spinning forever
- Notes: two stale 'not built yet' comments (blocking, server functions) now say what exists
- Rental page: the small piece photo loads the thumbnail, not the full-size photo
- Offline: Messages, Activity, rentals, the feed and comments say 'Couldn't load' instead of a false 'nothing here yet'

---

## 2026-10-23 (run 23, ~2 AM Central) — Bigger text that doesn't break, VoiceOver fixes, and the App Store privacy answers

**Plan:** F7 (waitlist) still waits on your decision, so on to section G, App Store readiness. G2 first — make the app work with the iPhone's bigger text sizes and with VoiceOver (the screen reader blind users rely on, which Apple checks). Then G5, a sweep for test/placeholder text, and G4, the list of data we collect for Apple's privacy form. G3 (no crashes offline) is too big to start this late — next run.

**Built:**
- **Text follows her phone's Text Size setting.** If she has bigger text on her iPhone, Loane's text gets bigger too — up to 1.5 times normal. That covers every normal size on the iPhone. The extra-large "Accessibility" sizes stop at 1.5x, because past that the price on a button, the occasion chips and the screen titles would spill out of their shapes (Instagram does the same). I checked each fixed-size piece fits at 1.5x; text boxes were the one tight fit, so they now grow instead of cutting letters off. The logo and the initials in a profile circle stay the same size, because they're drawn inside fixed circles.
- **VoiceOver speaks properly:**
  - Every on/off switch now says what it is ("Show read receipts, switch, on") — before it said just "switch, on".
  - Every text box says what it's for ("Email", "Message", "Search closets and pieces") — before, sign-in and signup boxes only read their grey hint text.
  - Screen titles and big headings are announced as headings, so she can jump between them.
  - I checked every tappable thing in the app with a script: all of them already had a spoken name or their own words. Earlier runs did this well.
- **App Store privacy answers** — `docs/app-store-privacy.md`. When you submit to the App Store, Apple makes you fill in a form about what data the app collects. This page is the answer sheet, written from the code: names, emails, phone (optional), photos, messages, comments, rentals, sizes, app usage, help requests. **No tracking, no ads, no outside analytics** — so the "tracking" box is No and the tracking popup isn't needed. Contacts count as "not collected" (they're scrambled on her phone and never saved). It also says what to add when payments, Try-On or a crash reporter get switched on.

**What to tap to see it:**
- iPhone **Settings → Accessibility → Display & Text Size → Larger Text** → drag the slider right → open Loane. Text is bigger; buttons, chips and the price tags still hold together.
- iPhone **Settings → Accessibility → VoiceOver** → on (triple-click the side button to turn it off again). In Loane: Settings → Privacy → touch the read receipts switch → it reads the name. Sign out → Sign in → touch the email box → it says "Email".
- The privacy answers: open `docs/app-store-privacy.md` on GitHub (autopilot branch).

**Fixed:**
- On/off switches and text boxes that VoiceOver couldn't name (above).
- A leftover note in the listing form said "blocking out dates comes later" — that screen has existed for a while (Edit listing → Blocked dates). Note corrected; nothing a student sees changed.

**Skipped / blocked:**
- **G5 (remove test/placeholder text):** swept every screen — found nothing to remove. "Payments are coming soon" on Payouts is on purpose while payments are off. Marked done.
- The overnight machine still can't start the test database (Google's download is blocked here). Passed: type checks, lint, the index check (84 searches, none missing), all 283 shared tests, the server tests that don't need the database, and the iPhone app build. Tonight changed no server code or database rules — only the app's screens.

**🚨 NEEDS ZACK:**
- Still the one decision from run 22: USC-only with a waitlist, or keep letting any .edu in.
- New, for when you submit to the App Store (no rush): Apple needs a public web link to the Privacy Policy. Make sure it's live on joinloane.com, and use `docs/app-store-privacy.md` to fill in the privacy form.

**Next up:** G3 — make sure nothing crashes with no internet, slow internet, or a deleted post/account. Then H.

**Commits:**
- Accessibility: text grows with the iPhone's Text Size (up to 1.5x); VoiceOver names for switches, fields and headings
- Listing form: replace a stale 'blocked dates come later' note — that screen exists now
- App Store privacy answers: every kind of data Loane keeps, in Apple's categories

---

## 2026-10-23 (run 22, ~1 AM Central) — "Get started" after signup, a "My size" filter, social proof, a shorter tour

**Plan:** Section F, onboarding, top to bottom. F1–F4 as one new "Get started" screen right after Create account (rent/lend/both → what's coming up → your size → follow 3 closets), then F5 the welcome-screen number, F6 the invite step, F8 the dashboard funnel and F9 the shorter tour. F7 (waitlist) needs a decision first — see NEEDS ZACK.

**Built:**
- **"Get started" — five quick screens after she creates her account,** each with Skip in the corner and Back to change an answer:
  1. *How will you use Loane?* — Find something to wear / Earn from my closet / Both.
  2. *What's coming up?* — tap any of the 8 occasions. Her feed and Discover then lean toward those looks from her very first scroll (before she has liked anything). Once she starts liking looks, her real taste takes over.
  3. *Your size* — tops, bottoms, dresses, shoes, all optional. Saved to her profile but still hidden from other girls unless she turns "Show my sizes" on.
  4. *Follow 3 closets* — a list of girls to follow (friends-of-friends first, then the most-followed closets at USC). Next unlocks at 3. On a brand-new campus with fewer closets, following what's there is enough.
  5. *Invite your roommates* — opens the share sheet with the same message as Invite Friends.
  If she said "lend" or "both", the last screen also has **Put a piece on Loane**, which takes her straight to listing her first piece.
  Only brand-new accounts see this. Everyone already signed up is never asked.
- **"My size" filter on Discover.** Filter → a "My size" switch at the top, showing which sizes it uses ("Dresses S · Shoes 8"). It hides a piece only when we know it won't fit; bags, jewelry and pieces listed without a size still show. If she has no sizes yet, it offers "Add my sizes".
- **Welcome screen social proof.** Under "STYLE. SHARED." on the very first screen: "Join 120+ girls at USC" — but only once USC has 50+ students, and always rounded DOWN so it's never an exaggeration. Deleting an account now takes her out of that count, so it stays true.
- **Dashboard: Get Started Funnel** (Overview page). How many started, answered each step, followed 3, invited, and reached the feed — plus how many said rent vs lend vs both. That last line is an early answer to "will girls lend?".
- **The walkthrough is 3 steps, not 6:** the feed, the + button, and Activity.

**What to tap to see it:**
- Sign out → Find your campus closet → make a new account with any @email.sc.edu address → after "Create account" you land on *How will you use Loane?*. Pick one → Next → pick Formal → Next → pick a dress size → Next → follow 3 girls → Next → Invite roommates (or Start exploring).
- Discover → Filter → turn on **My size** → Show results.
- Admin dashboard → Overview → **Get Started Funnel** (empty until someone signs up on the new version).
- The welcome-screen number won't show on the test data — it only has a handful of fake students, under the 50 needed.

**Fixed:**
- Nothing broken was found this run. One honesty fix: the campus student count used to only ever go up (deleted accounts still counted). Now deleting lowers it.

**Skipped / blocked:**
- **F7 (waitlist for non-USC emails)** — needs your call first, see NEEDS ZACK.
- The overnight machine still can't start the test database (Google's download is blocked here). Passed: type checks, lint, the index check (84 searches, none missing), all 283 shared tests (17 new), the server tests that don't need the database, the iPhone app build and the dashboard build. This run DID change the database rules (her Get started answers) and account deletion, with new tests written for both. **GitHub ran the full set, database tests included, on tonight's push: all green ✅.**

**🚨 NEEDS ZACK:** One decision — USC-only with a waitlist, or keep letting any .edu in (details at the top of this file).

**Next up:** F7 once you decide; otherwise G2 — large text sizes and VoiceOver labels on every button.

**Commits:**
- Get started after signup: rent/lend/both, what's coming up, and your size
- Discover: a 'My size' filter that uses the sizes on her profile
- Get started: a 'Follow 3 closets' step at the end
- Welcome screen: 'Join 120+ girls at USC' once the campus has 50+ students
- Get started: an 'Invite your roommates' step, sharing the same invite as Invite Friends
- Dashboard: a Get Started funnel — each step answered vs skipped, and rent/lend/both
- Walkthrough: three steps instead of six — feed, the +, and Activity

---

## 2026-10-23 (run 21, ~midnight Central) — Comment hearts and @mentions, better search, grouped Activity, haptics

**Plan:** E4 — finish comment threads (heart a comment, @mention someone with suggestions, alerts for replies and mentions). Then the rest of section E in order: profile polish, search with recent searches, grouped Activity with "Mark all as read", empty states with a next step, and haptics.

**Built:**
- **Heart a comment.** A small heart on every comment; tap it and the count under the comment goes up ("3 likes"). The girl who wrote it gets "@you liked your comment".
- **@mentions in comments.** Type @ and a couple of letters and names pop up above the keyboard — girls already in that conversation first, then anyone on campus. Tap one to fill it in. @names in comments show in bold and open that closet when tapped. The girl you mention gets "@you mentioned you in a comment" (up to 5 people per comment, never anyone who blocked you or you blocked).
- **Reply alerts.** Replying to a comment now tells that girl "@you replied to your comment". Nobody gets two alerts for one comment.
- **"Discard changes?"** If she edits her profile, a look or a piece and goes back without saving, Loane asks first instead of quietly throwing her work away.
- **Discover search, Instagram-style.** Tap the search box: her recent searches show (remove one with the x, or Clear all). Start typing: matching girls show as a row of names above the pieces, and typing an occasion ("formal", "date", "gameday") offers "Formal · see all".
- **Activity → Updates, grouped.** "@ella and 4 others liked your look" instead of five rows; same for new followers. Tapping any update now takes her to the right place — the look, the comments, the girl's profile, or the rental (before, only rental updates went anywhere). A **Mark all as read** link at the top.
- **Empty screens point somewhere.** "Not found" pages, an empty Updates tab and an empty inbox now have a button for what to do next (Find something else / Back to the feed / See my rentals / Find closets to follow).
- **Haptics.** A light tap you can feel when she likes, saves, hearts a comment, follows, or sends a message or comment.

**What to tap to see it:**
- Open any look → comments → tap the heart next to a comment. Type "@" then two letters of a name → tap a name in the list → Post.
- On a reply, tap Reply → the box starts with her @name.
- Profile → Edit profile → change your bio → tap back → "Discard changes?"
- Discover → tap the search box → search "dress" and press search → clear it and tap the box again → "dress" is under Recent. Type "form" → tap "Formal · see all".
- Activity → Updates → tap "Mark all as read". Tap a like or follow update → it opens the look or profile.
- On a real iPhone: like a look — you'll feel a small tap.

**Fixed:**
- Tapping Reply on a reply (not the top comment) used to fail with an error, because threads only go one level deep. It now posts under the top comment with her @name in front, like Instagram.
- Updates about likes, comments and follows did nothing when tapped. They now open the right screen.

**Skipped / blocked:**
- Comment hearts aren't counted in our data yet — that needs a new event type in the database rules; added to the backlog.
- The overnight machine still can't start the test database. Type checks, lint, the index check (82 searches, none missing), the shared tests (266, 27 new), the server tests that don't need the database, and the iPhone app build all passed. This run DID change the database rules (one new, locked-down list for comment hearts) and server functions, with new rules tests written for it — GitHub runs those on tonight's push, so check the green tick there before merging.
- Onboarding (section F) not started — next run.

**🚨 NEEDS ZACK:** Nothing to decide. When you next deploy, it adds the comment-heart functions — normal deploy.

**Next up:** F1 — onboarding "Rent / lend / both" step (then F2 occasions, F3 sizes).

**Commits:**
- Comments: heart a comment, @mention autocomplete, reply and mention alerts
- Ask 'Discard changes?' before leaving Edit Profile, Edit Look or Edit Listing with unsaved edits
- Discover search: recent searches, matching students and occasions while typing
- Activity updates: group likes and follows, open the right place, mark all as read
- Haptics: a light tap on like, comment heart, follow and send
- Empty states: a next step on 'not found' screens, empty Activity and an empty inbox
- Autopilot log for run 21

---

## 2026-10-23 (run 20, ~11 PM Central) — Grey placeholders everywhere, and press-and-hold to preview

**Plan:** Finish E2 — grey placeholders on the last screens that still showed a small spinner on a blank page (Discover, profiles, My Listings, Saved, Reviews, a look, a piece, a chat). Then E3 — double-tap to like (check it) and press-and-hold a grid tile to see it big.

**Built:**
- **Grey placeholders are now on every screen that loads a list or a page.** Shaped like what's coming, so nothing jumps when it arrives:
  - Discover: a grid of grey piece cards with two little lines under each (name and price).
  - Profiles (yours and other girls'): a grey round photo and name, then three-across grey squares where the closet goes.
  - A look or a piece: a big grey photo, the owner row, a few lines of text.
  - A chat: grey message bubbles on both sides.
  - My Listings, Reviews, Recently Rented: grey rows. Saved: grey grids on each tab.
  - The home feed keeps the Loane logo loader, as before.
- **Press and hold to preview** (like Instagram). On a profile's Closet or Posts grid, and on Liked and Saved → Looks, holding a tile pops up a big card: the full photo, whose it is, and the price (pieces) or how many pieces are tagged (looks). Tap the card to open it; tap outside to close.
- **Double-tap to like with the heart** was already built — nothing to add.

**What to tap to see it:**
- Profile → press and hold any square in your closet → the preview pops up → tap it to open the piece, or tap the dark area to close. Same on Posts, and on another girl's profile.
- Menu → Liked → press and hold a look.
- Placeholders: open Discover, any profile, a look, a piece or a chat — you'll see grey shapes for a moment before the real thing. (On fast wifi it's a blink; on slow signal it's what she sees instead of a blank screen.)

**Fixed:** Nothing broken this run.

**Skipped / blocked:**
- The preview stays open until she taps, instead of closing when she lets go like Instagram's. On iPhone, a pop-up that appears under a finger can cancel the touch and close itself instantly; tap-to-close always works. Written up in `docs/decisions.md`.
- Previews aren't counted in the data yet, on purpose — counting them as a "view" would skew the For You ranking. Counting them properly needs a database rules change, so it's on the backlog for a run where those tests can run.
- Press-and-hold isn't on Discover's grid yet (those cards already show name and price). Added to the backlog.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (81 searches, none missing), the shared tests (239), the server tests that don't need the database, and the iPhone app build all passed. Nothing tonight changed the database rules or server functions; GitHub runs the full set on tonight's push.

**🚨 NEEDS ZACK:** Nothing new. Older items are listed at the top.

**Next up:** E4 — comment threads: reply to a comment, like comments, @mention autocomplete.

**Commits:**
- Skeleton loaders on Discover, profiles, My Listings, Saved, Reviews, a look, a piece and a chat
- Press and hold a grid tile to preview it
- Autopilot log for run 20

---

## 2026-10-23 (run 19, ~10 PM Central) — Pull to refresh finished, long lists keep going, grey placeholders while lists load

**Plan:** Finish E1 — pull to refresh on the last lists (comments, followers/following, who liked a look), and find any list that quietly stops instead of loading more. Then start E2 — grey placeholder rows and tiles while a list loads, instead of a small spinner on a blank screen.

**Built:**
- **Pull down to refresh** now also works on comments, Followers / Following lists, and "who liked this look". That finishes it — every list in the app has it.
- **"Who liked this" no longer stops at 200 people.** It loads 30 at a time and keeps going as she scrolls. If it can't load, it says "Couldn't load likes — Try again" instead of wrongly saying "No likes yet". Pulling down really reloads it.
- **Activity → Updates no longer stops at 50.** Older updates keep loading as she scrolls down.
- **Grey placeholders while lists load** (like Instagram): instead of a lone spinner on a blank white screen, she sees soft grey rows shaped like what's coming, gently pulsing. On Messages, message requests, Activity (both tabs), comments, Followers / Following, who liked, My Rentals and Rental requests — and a grid of grey tiles on Liked. If her phone is set to Reduce Motion, they hold still.

**What to tap to see it:**
- Open any look → tap the comments → drag the list down → spinner.
- A profile → tap Followers (or Following) → drag down. Same on a look's "Liked by…" line.
- Messages, Activity, or Menu → My Rentals: as the screen opens you'll see grey rows for a moment before the real ones. (On fast wifi it's a blink — on slow signal it's what she sees instead of a blank screen.)
- Menu → Liked: grey tiles, then the looks.

**Fixed:**
- Older updates in Activity and likers past the first 200 used to just be missing. Now they load.

**Skipped / blocked:**
- On purpose, two lists still load in one go: the Messages inbox (latest 50 chats) and her rentals. The unread badge and the "Needs you" count read those same lists, so splitting them into pages would make the counts wrong. A girl will rarely have 50+ chats at launch. Added to the backlog as a later suggestion.
- Grey placeholders aren't on Discover, profiles, My Listings, Saved, Reviews, a look, a piece, or a chat yet (Discover and the feed already show the Loane logo loader). Next run.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (81 searches, none missing), the shared tests (239) and the server tests that don't need the database passed, and the iPhone app builds. Nothing tonight changed the database rules or server functions; GitHub runs the full set on tonight's push.

**🚨 NEEDS ZACK:** Nothing new. Older items are listed at the top.

**Next up:** finish E2 — grey placeholders on Discover, profiles, My Listings, Saved, Reviews, a look, a piece and a chat. Then E3 — double-tap to like with a heart, and press-and-hold preview on grid tiles.

**Commits:**
- Pull to refresh on comments, followers/following and who liked; who liked loads a page at a time
- Activity updates load a page at a time instead of stopping at 50
- Skeleton loaders: grey rows and tiles while lists load, instead of a lone spinner
- Autopilot log for run 19

---

## 2026-10-22 (run 18, ~6 AM Central) — Measuring Trending, and pull down to refresh everywhere

**Plan:** First the small Trending suggestion (D8) — record when a girl opens a piece from the Trending row, and whether she then asks to rent or buy it, so we can tell if Trending actually leads to rentals. Then start E1 — pull down to refresh on every main list, using one shared piece so they all feel the same.

**Built:**
- **We can now measure Trending.** When she taps a piece in the "Trending at USC this week" row, Loane notes that she came from Trending — on the piece's page view, and on her rent or buy request if she makes one from there. Nothing changes on screen. In the data you can now compare "opened from Trending" against "asked to rent from Trending".
- **Pull down to refresh** now works on Discover, Activity, your profile, other girls' profiles, Messages, message requests, My Listings, My Rentals, Rental requests, Saved, Liked and Reviews — the same merlot spinner everywhere.
  - On Discover, pulling down also re-works the "For you" order using her latest likes (the feed already did this).
  - Everywhere else the lists already update by themselves the moment something changes, so the pull is the familiar gesture with a quick spinner — it doesn't re-download everything (that would cost money and flash a blank loading screen for nothing).

**What to tap to see it:**
- Discover → drag the grid down → a spinner appears for a moment, then the For you order is refreshed.
- Activity, Profile, Messages, or Menu → My Rentals / My Listings / Saved / Liked → drag the list down → spinner.
- Trending tracking has nothing to tap; it shows up in the events data.

**Fixed:** Nothing broken this run.

**Skipped / blocked:**
- E1 isn't finished: comments, followers/following lists and "who liked this" still need pull to refresh, and a check that every long list loads in pages. Next run.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (81 searches, none missing), the shared tests (239, 2 new), the server tests that don't need the database (62) and the iPhone app build passed here. Nothing tonight changed the database rules or server functions; GitHub runs the full set on tonight's push.

**🚨 NEEDS ZACK:** Nothing new. Older items are listed at the top.

**Next up:** finish E1 (the last few lists, plus making sure long lists load page by page), then E2 — skeleton loaders instead of blank screens.

**Commits:**
- Trending: count taps on the row, and requests that came from it
- Pull to refresh on Discover, Activity, profiles, Messages and every list screen
- Autopilot log for run 18

---

## 2026-10-22 (run 17, ~5 AM Central) — "Trending at USC this week", and "You're all caught up"

**Plan:** Finish the For You section (D5–D7). D5 — a "Trending at USC this week" row on Discover, worked out every hour on Loane's server so nobody can put her own piece on it. D6 — put every ranking dial in one place and let the "why" printout explain Discover too. D7 — an honest "You're all caught up" line in Following once she's seen everything new.

**Built:**
- **"Trending at USC this week" on Discover.** A sideways row of up to 10 pieces at the top of Discover — the ones the most girls saved, asked to rent or buy, or tapped in a look over the last 7 days.
  - Worked out by Loane's server every hour, so it can't be faked from a phone.
  - Each girl counts once per piece, however many times she taps. Your own saves on your own piece don't count. A piece needs at least 2 different girls before it can trend.
  - Asking to rent counts most (4), saving next (2), tapping it in a look least (1).
  - Only shows when she's browsing everything — it hides while she searches or filters, and hides completely until at least 2 pieces qualify (so at launch it may not appear for a while — that's on purpose).
  - Blocked closets and sold pieces never show in it.
- **"You're all caught up" in Following.** Once she's scrolled past every look from people she follows posted in the last 3 days, a line says "You're all caught up — you've seen every new look from the past 3 days", and everything below is labelled **Older looks**. Like Instagram. No filler, no streaks, no guilt.
- **All the For You dials in one place**, and the laptop "why is this here?" printout now explains Discover and Trending as well as the feed.

**What to tap to see it:**
- Discover → (no search, no filters, **Explore** tab) → the **Trending at USC this week** row is above the grid. Swipe it sideways; tap a piece to open it. Type in the search box and the row disappears.
- Feed → **Following** → scroll down. If the people you follow have looks both from this week and older, you'll hit the **You're all caught up** line, then **Older looks**.
- On your laptop (emulators running, then `npm run seed` — the seed fills Trending once, since the test database never runs hourly jobs by itself): `cd backend/functions && npx tsx scripts/explainFeed.ts --user ellapetrickcloset --discover`

**Fixed:** Nothing broken this run.

**Skipped / blocked:**
- Not yet counted: how often girls tap the Trending row itself (added to the backlog as a suggestion).
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (81 searches, none missing), the shared tests (237, 12 new), the server tests that don't need the database, and the iPhone app build all passed here. Two new database tests (who can read and write the Trending list; the hourly count itself) run on GitHub with tonight's push.

**🚨 NEEDS ZACK:** Nothing new. Older items are listed at the top.

**Next up:** Section D is finished. Next is E1 — pull-to-refresh and smooth infinite scroll everywhere lists exist.

**Commits:**
- Discover: Trending at USC this week
- Ranking: every dial in one place, and a Discover mode for the why printout
- Following: a You're all caught up line between new looks and older ones
- Autopilot log for run 17

---

## 2026-10-22 (run 16, ~4 AM Central) — All Campus is now "For You", and Discover opens on "For you"

**Plan:** D3 — spread the feed out (no girl three times in a row, and some closets she doesn't follow mixed in). D4 — switch All Campus to the ranked order without cards jumping around while she reads; Following stays newest-first. Then start D5 — the same idea for Discover's grid of pieces. Leave "Trending this week" for its own run because it needs a new server job.

**Built:**
- **All Campus is ranked for her.** Instead of strictly newest first, the looks she's most likely to love come first: from people she follows and likes, for occasions she cares about, recent, doing well for how many people saw them, with pieces she can actually get this week.
- **Variety.** Never more than 2 looks in a row from the same girl, however popular she is.
- **New closets keep showing up.** At least 1 in every 4 looks is from someone she doesn't follow (while there are any), so the feed doesn't shrink to the same friends.
- **Nothing jumps while she's reading.** Once a look is on screen it stays in its place, even if it gets a pile of likes. Brand-new looks appear at the top, older ones load at the bottom as she scrolls, and pulling down to refresh works the order out again with her latest likes.
- **Following is unchanged** — still newest first.
- **Discover opens on "For you".** The grid of pieces is now ordered for her too: closets she follows, occasions she saves pieces for, newer pieces, pieces that get saved and rented a lot for how often they're viewed — and above all, pieces she can actually rent or buy this week. "Newest" and the price sorts are still in the sort menu. Tiles don't reshuffle while she browses.

**What to tap to see it:**
- Feed → **All Campus**: the order is no longer simply newest first. Scroll down and you won't see the same girl three times in a row. Tap **Following**: still newest first.
- Like a few looks, then pull down on All Campus to refresh → the order updates once.
- Discover → the sort button under the search bar now reads **For you**. Tap it to switch to Newest or price.
- On your laptop (emulators running and seeded): `cd backend/functions && npx tsx scripts/explainFeed.ts --user ellapetrickcloset` — now shows the final order, with a look's pure-score place in brackets when the variety rules moved it.

**Fixed:** Nothing broken this run.

**Skipped / blocked:**
- **"Trending at USC this week"** (the rest of D5). The numbers Loane keeps are all-time totals, so they can't say "this week". It needs a small server job every hour that counts the week's saves, piece taps and requests per piece — one per person, so nobody can fake a piece onto the list. Next run.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (78 searches, none missing), the shared tests (225, 18 new) and the iPhone app build all passed here. Nothing tonight changed the database rules or server functions; GitHub runs the full set on tonight's push.

**🚨 NEEDS ZACK:**
- **One visible change to OK:** All Campus is no longer newest first, and Discover now opens on "For you" instead of "Newest". This is what the backlog asked for (D4/D5), but it's the biggest change to how the app feels so far — if you'd rather Discover still open on Newest, it's a one-word change.
- Nothing else new. Older items are listed at the top.

**Next up:** finish D5 — "Trending at USC this week" on Discover. Then D6 (tidy the ranking dials — mostly done) and D7 ("You're all caught up" on Following, no filler).

**Commits:**
- For You: no more than two looks in a row from one girl, and new closets mixed in
- For You: All Campus is ranked, and a look never moves while she reads
- For You: one place reads what the ranking knows about her
- Discover: a For you order for pieces, and it's the default sort
- Autopilot log for run 16

---

## 2026-10-22 (run 15, ~3 AM Central) — The "For You" score exists

**Plan:** D2 — give every look a score for each student, made of five parts: who posted it, whether it's her kind of occasion, how new it is, how well it does for the number of people who saw it, and whether the tagged pieces can actually be had this week. Every number in one place. Decide where the score is worked out so nobody can cheat their own look up campus. Don't change the feed screen yet — that's D3/D4.

**Built:**
- **A score for every look, for every student.** Nothing changes on screen yet; next runs plug it into All Campus. What makes a look rank higher for her:
  - **Who:** she follows the author (more if they follow each other back), or she's liked that girl's looks before — with a ceiling, so one best friend can't take over the feed.
  - **What:** the look is tagged with occasions she likes (Gameday, Formal…), learned from looks she's liked.
  - **Fresh:** new looks first; a look loses half its "newness" every day and a half.
  - **Quality:** how much people do per person who saw it — not raw likes. A new look with 4 likes from 10 people beats an old one with 30 likes from 600. A tap through to a tagged piece counts most.
  - **Available:** the pieces in the look can actually be rented or bought this week. A look full of pieces that are booked solid sinks a little.
- **It can't be gamed from a phone.** The parts about her only reorder her own feed. The parts that could push a look up everyone else's feed use only numbers Loane's server keeps. Written up in `docs/decisions.md`.
- **All the dials in one place** (`FEED_RANKING`), explained in plain words in `docs/feed-algorithm.md`.
- **A "why did this rank there" printout** for your laptop: shows every look in order with its five scores.

**What to tap to see it:** Nothing on the phone yet. On your laptop, with the emulators running and seeded: `cd backend/functions && npx tsx scripts/explainFeed.ts --user ellapetrickcloset` prints Ella's For You order and why.

**Fixed:** Nothing this run.

**Skipped / blocked:**
- The "why" printout couldn't be run here — the overnight machine still can't start the test database (Google's download site is blocked). It type-checks, and it uses the exact same scoring that's tested.
- Type checks, lint, the index check (74 searches, none missing), the shared tests (207, 19 new) and the server tests that don't need the database (62) all passed here.

**🚨 NEEDS ZACK:** Nothing new. Older items are listed at the top. (If you ever want the feed to lean more on friends, or more on brand-new looks, it's one number each — just say.)

**Next up:** D3 — no more than 2 looks in a row from the same girl, and a few looks from people she doesn't follow mixed in. Then D4 — switch All Campus to the ranked order (Following stays newest-first).

**Commits:**
- For You: a ranking score per look, with every weight in one place
- Autopilot log for run 15

---

## 2026-10-22 (run 14, ~2 AM Central) — The app now notices what she scrolls past

**Plan:** D1 — before building the "For You" feed, make sure Loane records everything it will learn from. Most of it was already recorded (likes, saves, comments, shares, piece taps, requests). Two things were missing: which looks she scrolled past and how long she looked at each, and follows made from anywhere except a profile page. Add both, keep it to one record per look so it stays cheap, and write down the full list. Stop before D2 (the ranking itself) — it deserves a run of its own.

**Built:**
- **Loane now knows which looks she actually looked at.** As she scrolls the feed, each look she sees is recorded once, with how long it stayed on screen. A look she stopped on for five seconds counts for a lot more than one she flicked past. Nothing changes on screen — this is the raw material for the "For You" feed.
  - Under a third of a second is a flick and isn't counted.
  - Capped at one minute, so a phone left open on one look doesn't make it the most-loved post on campus.
  - Once per look per app session — scrolling up and down the same ten looks doesn't pile up hundreds of records.
- **Follows that were never counted now are.** Following someone from the "Suggested closets" row in the feed or from Find Friends, and unfollowing from your Following list, used to leave no record. Now they do, and they say where they came from.
- **Opening a profile now says where she tapped from** — her name on a look in the feed, the suggested closets row, or somewhere else. The algorithm needs that to tell "loved her look" apart from "looked her up".
- **`docs/feed-algorithm.md`** — the start of the algorithm's handbook: a table of every signal Loane records, where it comes from, and the rules for counting a look.

**What to tap to see it:** Nothing new on screen — this is all behind the scenes. To check it on your laptop: run the app with the emulators, scroll the feed slowly for a few looks, then open the emulator page (localhost:4000) → Firestore → `events` and you'll see `post_impression` rows with `dwellMs` (how long, in thousandths of a second).

**Fixed:**
- Follows from Suggested closets and Find Friends, and unfollows from the Following list, were invisible in the numbers. Counted now.

**Skipped / blocked:**
- **D2, the ranking itself** — next run. It needs a decision on where the scoring runs (on Loane's server, every few minutes, so one student's phone can't fake a post up the feed); that's a design job for a full hour.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (74 searches, none missing), the shared tests (188, 6 new), the server tests that don't need the database (62) and the iPhone app build all passed here. The one new database rule test (a feed impression is accepted) runs on GitHub with tonight's push.

**🚨 NEEDS ZACK:** Nothing new. Older items are listed at the top.

**Next up:** D2 — the ranking score per post (who posted it, what it is, how fresh, how good, whether the pieces are actually rentable), with the weights in one config file.

**Commits:**
- Feed: record which looks she scrolled past and how long she looked
- Follows and profile opens say where they came from
- Autopilot log for run 14

---

## 2026-10-22 (run 13, ~1 AM Central) — One switchboard for risky features, and "Download my data"

**Plan:** C8 — put every risky or unfinished feature (try-on, email codes, same-day, payments) behind one set of switches in one place, without changing what's on or off today. Then C9 — a way to download everything Loane holds about one student, for her and for privacy requests (deleting already exists as "Delete my account"). Stop before the feed algorithm (D1), because it changes the activity-tracking rules, which can't be tested on the overnight machine.

**Built:**
- **Feature switches, all on one panel.** The admin dashboard's Overview now has a "Feature switches" panel with five rows: AI Try-On, Try-On admin preview, Email codes at sign-up, Same-day pickup, and Payments. Each says what it does, whether it's on, and has a Turn on / Turn off button that asks for a reason and leaves a line in the Activity Log. Flipping one takes effect in the app straight away — no new app build.
  - **Nothing changed state:** try-on off, email codes off, same-day on, payments off — exactly as before.
  - **Two are locked off on purpose.** Email codes and Payments show "Locked" with the reason (no email service yet; no Stripe account yet). They can't be switched on by accident; unlocking them is a deliberate one-line change once the setup is real.
  - **Same-day now has an off switch** for a bad weekend: off hides "Available same day" when listing a piece (her own choice is kept for when it comes back), and the request screen says "Same-day pickup is paused right now."
  - The old try-on-only panel is replaced by this one (its two switches are the first two rows).
- **Download my data.** Settings → **Download my data** → Download. Loane gathers everything about her — profile, email and phone, pieces, looks, comments, likes, saves, follows, rentals, reviews, chats, reports, help requests and activity — into one file, and the phone's share sheet opens so she can save it to Files or send it to herself. Limited to three a day. Left out on purpose: security codes and our private admin notes.
- **Export her data, for privacy requests.** In the dashboard, open a student → Moderation → **Export her data** → type the reason (e.g. "privacy request by email, Oct 22") → a file downloads. Logged in the Activity Log.

**What to tap to see it:**
- Admin dashboard → Overview → **Feature switches** panel. Tap **Turn off** on Same-day pickup, type a reason, confirm. Then on the phone: Profile → + → Add to My Closet → the "Available same day" switch is gone. Turn it back on in the dashboard and it reappears.
- Phone: request to rent any piece and pick today's date → if the piece doesn't offer same-day you now see "This piece isn't available same day. Pick a later date." straight away, instead of only after tapping send.
- Phone: Profile → Menu → Settings → **Download my data** → Download → the share sheet opens with "loane-my-data-2026-10-22.json". (Needs a fresh `npm run seed` first so the switchboard exists; without it, the defaults apply anyway.)
- Admin dashboard → Users → any student → **Export her data**.

**Fixed:**
- Picking today on a piece that doesn't offer same-day used to give no warning until she tapped send. It now says so as soon as she picks the date.

**Skipped / blocked:**
- **An admin "delete this account" button** for privacy requests — deleting is still her own "Delete my account". Added to the backlog as a suggestion (C11).
- **D1 (reliable activity tracking for the feed algorithm)** — next run. It needs new kinds of activity (what she scrolled past, how long she looked) and a change to the database rules that guard activity tracking; the overnight machine can't run the rules tests, so it deserves a run where GitHub's checks are watched closely.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (74 searches, none missing), the shared tests (182, 12 new), the server tests that don't need the database (62, 4 new), the admin dashboard build and the iPhone app build all passed here. New database tests for the switchboard (6), the switchboard's rules (3) and the data export (6) run on GitHub with tonight's push.

**🚨 NEEDS ZACK:**
- **After your next deploy:** glance at Overview → Feature switches on the live dashboard (details at the top of this log). Nothing to decide.
- Nothing else new. Older items are listed at the top.

**Next up:** D1 — make sure every kind of activity the feed algorithm needs is recorded reliably (what she scrolls past, how long she looks, likes, saves, comments, shares, piece taps, profile taps, follows, requests). Then D2 — the ranking score.

**Commits:**
- Feature switches: one switchboard for try-on, email codes, same-day and payments
- Download my data: one file with everything Loane holds about her
- Autopilot log for run 13

---

## 2026-10-22 (run 12, ~midnight Central) — Bad signal never looks like an empty app, and crashes say so

**Plan:** Finish C6 (friendly errors): the screens run 11 didn't reach, then the server side — every server function gives a clear message and leaves one findable note in the logs when something unexpected breaks. Then C7 (get the app ready for a crash reporter, switched off) and C10 (write the backup and alert steps for the live project — writing only, not doing). C8 (feature switches) and C9 (data export) are left for the next run because they deserve a full hour each.

**Built:**
- **"Couldn't load … Try again" on every remaining list.** These used to show their empty message on a bad signal, which reads as her stuff having disappeared:
  - My Wishlist (pieces and looks), Liked, Reviews
  - A profile's Closet and Looks grids, My Listings
  - Opening someone's profile (it used to say "Closet not found")
  - A single look (it used to say "That look is no longer up")
  - A chat (it used to say "Say hello", as if there were no messages)
  - Help → Past reports
- **The feed keeps what she's already scrolled.** If the next page failed to load, the whole feed was swapped for an error screen and every look she'd scrolled through vanished. Now they stay, and the bottom says "Couldn't load more looks. Tap to try again."
- **Clear messages from the server.** When something unexpected breaks behind the scenes, she used to get a vague message (the server literally sent the word "INTERNAL"). Now she sees either "Loane is busy right now. Try again in a moment." (when trying again will help) or "Something went wrong on our side… send us this code: 3f9a1c". That same six-letter code is written in the server logs next to which feature broke and for which student — so a screenshot from a girl is enough to find the exact problem. Every one of the 38 server features goes through this. 14 new tests.
- If her phone can't reach Loane at all, buttons that talk to the server now say "Could not reach Loane. Check your connection" instead of a generic error.
- **A crash screen instead of a white screen.** If a screen ever crashes, she sees "Something went wrong — That screen hit a snag" with **Try again** and **Back to the feed**.
- **Crash reporting is wired in but switched off.** The day you pick a crash-reporting service, turning it on is one file. It will only ever identify a student by an anonymous id — never her name, email or messages.
- **`docs/production-ops.md`:** a click-by-click checklist for the live project — a $25/month spending alert, daily database backups, photo recovery, and emails when errors start. Nothing switched on.

**What to tap to see it:**
- Turn on airplane mode, then open: Profile → your Closet or Looks; Menu → My Wishlist or Liked; anyone's reviews; any chat; a look from a profile. Each shows "Couldn't load …" with **Try again**. Turn airplane mode off, tap Try again → it loads.
- Feed: scroll down a long way, turn on airplane mode, keep scrolling → your looks stay and the bottom says "Couldn't load more looks. Tap to try again."
- The crash screen and the server messages only appear when something actually breaks, so there's nothing to tap for those.

**Fixed:**
- One failed page while scrolling the feed wiped out the whole feed.
- Pulling down to refresh the feed after scrolling a long way skipped a page of older looks on the next scroll.
- The feed's error said "pull to refresh" with nothing to pull — it now has a real Try again.
- My Wishlist could quietly drop saved pieces when a load failed, making them look deleted.

**Skipped / blocked:**
- **C8 feature switches and C9 data export** — next run. Note for C8: try-on and email codes already have their own on/off switches; C8 will gather them into one place without changing what's on or off.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (73 searches, none missing), the shared tests (170) and the server tests that don't need the database (58, including the 14 new ones) passed here, and the app builds cleanly for iPhone. GitHub runs the full set on tonight's push.

**🚨 NEEDS ZACK:**
- **Pick a crash reporter** when you're ready (Sentry's free tier is the usual choice; needs a sign-up and a development build of the app). No rush before beta.
- **The live-project checklist** in `docs/production-ops.md` — about 30 minutes in a browser. The spending alert is free and worth doing now; backups cost cents a month.
- Still waiting on your OK from run 10 (Followers/Following newest-first instead of A–Z).

**Next up:** C8 — one switchboard for risky features (try-on, email codes, same-day, payments), keeping all of them exactly as they are now. Then C9 — export or delete everything about one student.

**Commits:**
- Saved, liked and reviews: Try again instead of a false empty
- Profiles, My Listings and a look's page: Try again instead of a false empty
- Feed: one bad page no longer wipes the feed, and Try again works
- Cloud Functions: friendly errors and one findable log line for surprises
- Chat and Help: say when they couldn't load instead of looking empty
- Crash reporting: ready but switched off, and a crash screen instead of white
- Production ops: step-by-step backups, spending and error alerts (not run)
- Autopilot log for run 12

---

## 2026-10-22 (run 11, ~11 PM Central) — No more "nothing here" when it's really a bad signal

**Plan:** Finish C5 (paging) with search, then start C6 (friendly errors). Discover's piece search stays on the phone — that was a deliberate decision written in the roadmap, and replacing it means a paid search service, so it isn't mine to change. People search was the real gap: it had no limit at all. Then go screen by screen and make a failed load say so, with a Try again, instead of pretending the list is empty.

**Built:**
- **People search is capped.** Typing two letters in Find friends or "Send to" used to download every student whose @handle started with them, just to show 20. Now it asks for 30 at most. If the search fails, she sees "Couldn't search right now" with **Try again** — before, it said "Nobody by that name", which was wrong.
- **"Couldn't load … Try again" on the screens that matter most.** Before tonight, if the phone lost signal while loading, these screens just showed their empty message — "No rentals yet", "Nothing yet", "No messages yet" — which would make a girl think her booking or chats had vanished. Now they say what happened and give her a button that tries again:
  - Discover
  - Activity (both the Rentals and Updates tabs)
  - My Rentals and Requests
  - A single rental's page
  - A piece's page (before, a failed load said "That piece is no longer listed")
  - Messages and Message requests
- A piece or rental she's not allowed to see still says "Not found", because trying again can't change that.

**What to tap to see it:**
- Turn on airplane mode, then open the app and go to Activity, Messages, or Discover → you'll see "Couldn't load …" with a **Try again** button. Turn airplane mode off and tap Try again → it loads.
- People search: Profile → Find friends → type two letters of someone's @handle. Works as before, just lighter.

**Fixed:**
- Bad signal no longer looks like an empty account on eight screens.
- Discover's error message told her to "pull to refresh", but there was no pull-to-refresh. It now has a real Try again button.

**Skipped / blocked:**
- **Discover piece search stays on the phone, on purpose** (see the roadmap: it switches to a search service at ~1,500 pieces on one campus — USC is nowhere near that).
- **The rest of C6:** other lists (saved, liked, reviews, profile grids, a look's page) and making every server function return a friendly, specific message. Next run.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the index check (73 searches, none missing), the shared tests (170) and the server tests that don't need the database all passed here. GitHub runs the full set on tonight's push.

**🚨 NEEDS ZACK:**
- Nothing new tonight. Still waiting on your OK from run 10 (Followers/Following newest-first instead of A–Z).
- For later, not now: when one campus passes ~1,500 pieces, Discover search should move to a search service (Typesense, about $25/month). That's a spending decision, so it's yours.

**Next up:** finish C6 — the remaining screens, then friendly errors from the server functions.

**Commits:**
- People search: one capped page, and a Try again when it fails
- Activity, rentals and a piece's page: Try again instead of a false empty
- Messages: Try again when the inbox can't load
- Autopilot log for run 11

---

## 2026-10-21 (run 10, ~10 PM Central) — Long chats and comment threads load as you scroll, and an alarm for missing indexes

**Plan:** C5 — "load more as you scroll" and the automatic index check. Build the index check first (it protects the live app from the same crash the rental sweep had), then add paging to the lists that still loaded everything at once: chats, comments, followers/following. Leave search for its own run — it works differently (it searches on the phone).

**Built:**
- **An automatic alarm for missing indexes.** A database "index" is like the tabs in a filing cabinet: the live database refuses certain searches without the right one, but the test database on a laptop never does — that's exactly how the hourly rental sweep crashed for weeks unnoticed. A new check now reads every search in the app, the admin dashboard and the server (73 of them) and fails if any is missing its index. It runs with the other tests and on GitHub. **Result tonight: none missing.** To prove it works, I removed the rental sweep's index on purpose and it caught both searches that need it straight away.
- **Long chats load as you scroll up.** A chat used to show only its last 100 messages — anything older was simply gone. Now it opens with the latest 40 (quicker), and scrolling up brings in the next 40 with a small spinner, all the way back to the first message. If it can't load (bad signal), she sees "Couldn't load earlier messages. Tap to try again." Hearts, "Seen" and takedowns stay live on everything she's scrolled through.
- **Comments load 30 at a time,** with more as she scrolls down (up to 200, the old maximum). If they fail to load she now sees "Couldn't load comments — Try again" instead of a misleading "No comments yet".
- **Followers and Following lists load 30 at a time,** newest first (like Instagram), with more as she scrolls and a Try again screen if they fail. Before, they loaded everyone at once.

**What to tap to see it:**
- Chats: Messages → open a long chat → scroll up past the top; a spinner appears and older messages fill in. (The demo chats are short — to really see it you'd need a chat with more than 40 messages.)
- Comments: open any look → tap the comment bubble → scroll down. Turn on airplane mode and reopen comments to see the Try again screen.
- Followers: Profile → tap your Followers or Following number → scroll.
- The index alarm: on GitHub, Actions → tonight's run has a new "check:indexes" step with a green tick.

**Fixed:**
- Messages older than the last 100 in a chat could never be seen.
- Comments that failed to load pretended there were none.

**Skipped / blocked:**
- **Search paging** (the last part of C5) — search loads up to 1,000 pieces onto the phone and searches them there. Paging it properly is a bigger change; next run.
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the shared tests (169) and the server tests that don't need the database (including 14 new ones for the index alarm) all passed here. GitHub runs the full set on tonight's push.

**🚨 NEEDS ZACK:**
- **One small visible change to OK:** Followers/Following lists are now newest-first instead of A–Z. Loading a list a page at a time can't stay alphabetical without loading everyone. Instagram does newest-first. If you'd rather keep A–Z, say so.
- Still open from run 5: whether a deleted account's old @handle should ever be freed up, and when to start flagging "Venmo me" in chats.

**Next up:** finish C5 with search paging, then C6 — friendly errors and a retry on every screen.

**Commits:**
- Index check: fail tests and CI when a query is missing its production index
- Chat: load older messages as she scrolls up
- Comments: load a page at a time, with a retry when they fail
- Followers and following: newest first, a page at a time
- Autopilot log for run 10

---

## 2026-10-21 (run 9, ~6 AM Central) — Grids now load small photos

**Plan:** C4 — the image pipeline. Have the server make a small copy of every listing and look photo, and have every grid and list load the small copy instead of the full photo. Then start C5 by checking every database search the app does has its matching "index" (the thing that broke the hourly rental sweep for weeks).

**Built:**
- **Small photos in grids.** Every time someone posts a look or puts a piece on Loane, the server now makes a small copy of each photo (about a tenth of the size). Discover, profile grids, closets, My Listings, the wishlist, rentals and request rows, "Seen in" on a piece, and the closet picker now load the small copy. Scrolling should feel quicker on campus Wi-Fi and use far less of her data plan.
- **Nothing can go missing.** If the small copy isn't ready yet (the first second or two after posting) or doesn't exist (photos from before tonight, the demo pictures), the app quietly shows the full photo instead. Full-screen photos — the feed, a look, a piece's page — still use the full size so they stay sharp.
- **Deleting a photo deletes its small copy too.** The small copies also drop any hidden location data the phone's camera stamped into the photo.
- **Locked down:** anyone can view the small copies (same as the photos), but only the server can make them — a student can't sneak in a different picture for the grid than the one on her piece. Tested.
- **Database search check (start of C5):** every search the app and server run was checked against the list of indexes. **None are missing** — the live app shouldn't hit the same kind of crash the rental sweep did.

**What to tap to see it:**
- It looks the same — it's faster, not different. To check it: + → Add to My Closet → add a piece with a photo → Put it on Loane → go to Discover. Wait a couple of seconds and pull down to refresh; the piece's photo now comes from the small copy.
- On GitHub: github.com/zackcoet/Loane-code → Actions → tonight's run is a green tick.

**Fixed:**
- Grids were downloading full-size photos for little squares.

**Skipped / blocked:**
- **C5 pagination itself isn't done** (loading more as she scrolls in comments, messages, followers and search, plus a script that checks indexes automatically). Tonight only the by-hand index check was done. Next run.
- The overnight machine still can't start the test database, so GitHub ran the full set: **all passed.** Type checks, lint, the shared tests (165) and the new photo tests (6) passed here too.

**🚨 NEEDS ZACK:**
- Nothing urgent. When you next publish to the live project, the photo-shrinking runs as a new server function on Google's side — it costs a fraction of a cent per thousand photos, well inside the free tier at our size.

**Next up:** C5 — "load more as you scroll" everywhere, and an automatic index check script.

**Commits:**
- Image pipeline: small thumbnails for every listing and post photo
- Autopilot log for run 9

---

## 2026-10-21 (run 8, ~5 AM Central) — A ceiling on new pieces, and every part of the database now has a lock test

**Plan:** Finish C1 — put a limit on how many pieces one person can list in an hour (same trick as the message limit). Decide what to do about activity tracking. Then C2 — go through every part of the database and make sure each one has a test proving a student can't see or change what she shouldn't.

**Built:**
- **A limit of 60 new pieces per hour per student.** No real girl listing her closet will ever hit it (each piece takes photos and a form), but a script can no longer flood Discover with thousands of fake pieces. Editing a piece she already has doesn't count. If she somehow does hit it, she sees a friendly "take a breather and try again in a little while — your draft is still here" instead of an error, and no photos get uploaded for nothing.
- **Security review (C2) finished.** A new page, `docs/security-rules-review.md`, lists every part of the database in one table: who can see it, who can change it, and which test proves it. Ten new tests cover the parts that had none — the school list, published Terms, "who blocked me", damage claims, the server's own counters, reports and support requests, the unbuilt "circles", other girls' alerts and rentals, and a catch-all that refuses anything new nobody opened on purpose. **No holes were found** — every new test passed first time.

**What to tap to see it:**
- Nothing new to see on the phone — tonight was protection behind the scenes. You can still add a piece normally: + → Add to My Closet → fill it in → Put it on Loane. It works exactly as before.
- On GitHub: github.com/zackcoet/Loane-code → Actions → tonight's run is a green tick.

**Fixed:**
- The last open gap in the C1 audit that mattered (no limit on new pieces).

**Skipped / blocked:**
- **No limit on activity tracking — on purpose.** Adding one would double the database writes on the busiest thing the app does (logging what she scrolls past), which costs money, and could slow fast scrollers. The proper fix is "App Check" (Phase 8), which stops scripts entirely. Written up in the review page.
- The overnight machine still can't start the test database, so GitHub ran the full set: **all passed.** Type checks, lint and the 155 shared tests passed here too.

**🚨 NEEDS ZACK:**
- Nothing urgent. One thing to remember: the next time the database rules are published to the live project, publish the new app build at the same time — an older app without tonight's change can't add new pieces under the new rules. (Not a problem before launch, since nobody has an old build.)

**Next up:** C4 — the image pipeline (thumbnails so lists load small photos). Then C5 pagination with an index-checking script.

**Commits:**
- Rate limit: at most 60 new pieces per hour per student
- Security rules review: tests for every collection that had none
- Autopilot log for run 8

---

## 2026-10-21 (run 7, ~4 AM Central) — The bad-words filter now covers pieces and profiles

**Plan:** Finish the two small C1 gaps from last night: run the bad-words filter on piece names, piece descriptions, display names and bios, and stop a modified app saving a bio or name longer than the app allows. Leave the two rate-limit gaps (new pieces, activity tracking) for a run where the test database can be checked properly — both touch the "Put it on Loane" flow and are low risk while the campus is small.

**Built:**
- **The filter now reads pieces and profiles.** If someone puts a threat or a slur in a piece's name or description, or in her display name or bio, a report lands in the admin Reports queue marked "Automatic filter", with the words copied in. Like captions and comments, nothing is blocked — you decide. Only the words she actually changed are checked, so editing a price never files anything.
- **Length limits on profiles are now enforced by the database,** not just the phone: name up to 40 characters, bio up to 200. The phone already stopped her at these numbers; now a modified app can't get past them either. Anyone with an old, longer bio can still change her photo or sizes.

**What to tap to see it:**
- Profile → Edit profile → put "kys" in the bio → Save → admin dashboard → Reports → it's there marked "Automatic filter", about her profile.
- Or: + → Add to My Closet → put "kys" in the description → Put it on Loane → admin → Reports.

**Fixed:**
- The two audit gaps above (see `docs/server-side-audit.md`).

**Skipped / blocked:**
- The overnight machine still can't start the test database (Google's download site is blocked here). Type checks, lint, the shared tests (154) and the new filter tests (4) all passed here; GitHub ran the full set with the test database on tonight's code push, including the new length-limit tests: **all passed.**
- Rate limits on creating pieces and on activity tracking — next.

**🚨 NEEDS ZACK:**
- Nothing new.

**Next up:** C1's last two gaps (a ceiling on how many pieces one person can list per hour, and on activity tracking), then C2 — the full security-rules review.

**Commits:**
- Security rules: cap bio and name length at the app's limits
- Content filter: check piece names, descriptions, display names and bios
- Autopilot log for run 7

---

## 2026-10-21 (run 6, ~3 AM Central) — Take down a reported review or message, and a security hole closed

**Plan:** B7 — let an admin take down a reported review or a single message straight from the report (reviews also need the rating worked out again). Skip B8 (flag "Venmo me") — it waits until payments run inside the app, as logged last run. Then start C1: list every place the app writes to the database on its own and check each one is locked down.

**Built:**
- **Take down a reported review.** In the admin Reports queue, "Take the content down" on a review report now hides the review, and the girl it was about gets her star rating worked out again without it. A spiteful one-star stops counting the moment it's hidden.
- **Take down a reported message.** The same button on a message report wipes that one message for **both** people. In the chat it now reads "Message removed by Loane", and if it was the last thing said, the Messages list says that too. Nobody can heart it or reply to it. The original words are kept only in the admin history, so you still have a record.
- The admin dialog now says in one line what "Take the content down" will do for that kind of report before you confirm.
- **The audit (C1):** a new page, `docs/server-side-audit.md`, lists all 14 things the app still saves on its own, what stops each one being abused, and what's still worth tightening.

**What to tap to see it:**
- Admin dashboard → Reports → open a report about a review or a message → Action it → "Take the content down" → write a note → Action it.
- Then on the phone, open that chat: the message reads "Message removed by Loane". For a review, open the profile it was about: the rating has changed.

**Fixed:**
- **A real security hole:** a student could put back a piece you had taken down. The database checked what she was changing the piece *to*, but not what it was *before*, so a modified app could flip a taken-down (or removed, or sold) piece straight back to live. Now it can't. If she taps Edit on one, the phone explains instead of showing a form that can't save ("Taken down by Loane", "Removed" or "Sold").
- The behind-the-scenes tests could trip over each other because they share one test database. They now take turns.

**Skipped / blocked:**
- The overnight machine still can't start the test database, but GitHub ran everything: **both of tonight's pushes passed all checks**, including the new tests.
- C1 isn't finished. The audit found four small gaps, none of which let one student touch someone else's things, money or counts: listing names and bios aren't checked by the bad-words filter; bio and display name have no length limit; there's no limit on how fast someone can create listings; and the activity tracking can be padded by a script.
- A photo inside a removed message is unlinked from the chat but the file itself stays in storage. Fine for now.

**🚨 NEEDS ZACK:**
- Nothing new. A removed message can't be put back — tell me if you'd like an "undo" for admins.

**Next up:** finish C1 — run the word filter on listing text and bios, and cap bio/name length. Then C2 (security-rules review).

**Commits:**
- Admin reports: take down a reported review or message
- Security rules: a student can't put back a piece Loane took down
- Server-side audit doc, and this log

---

## 2026-10-21 (run 5, ~2 AM Central) — Delete my account, a bad-words filter, and automatic checks on GitHub

**Plan:** B4 "Delete my account" (Apple requires it), then B5 the word filter, then close the gap in B6 (admin actions on reports), then C3 automatic checks on GitHub — which also lets the security-rule tests finally run somewhere, since this machine can't start the emulators.

**Built:**
- **Delete my account.** Settings → Delete my account (at the bottom). The screen lists, in plain words, what gets deleted and what stays. She types her password, taps Delete, and confirms once more.
  - **Deleted:** her profile, photo, bio and sizes; her looks, closet and comments; her likes, saves, followers and following (everyone else's counts go back down); her phone number, school email, try-on photos, alerts, and her login.
  - **Kept, but shown as "Deleted account":** past rentals (the other girl's record), reviews she wrote, and chats (the other person keeps her copy). This is exactly what our Privacy Policy already promises.
  - **Refused while a rental is still going** — requested, accepted, out, being returned, or under a claim. She's told to finish or cancel it in My Rentals first.
  - The server double-checks she typed her password in the last 5 minutes, so an unlocked phone on a desk isn't enough.
  - Anyone opening her old profile sees "Account deleted". An old chat with her shows "This account was deleted. You can't reply."
- **Bad-words filter.** Captions (including edited ones), comments and messages are checked against a short list: threats ("kys", "kill yourself") and the common slurs, even when disguised with numbers or symbols. A match **doesn't block anything** — it drops a report in the admin Reports queue marked "Automatic filter", with the words copied in, so you decide.
- **Admin reports:** "Take the content down" now works on a reported comment too (before, only looks and pieces). Hide, warn and suspend were already there, each with an audit row.
- **Automatic checks on GitHub.** Every push to main or autopilot (and every pull request) now runs the type checks, lint, and all tests with the emulators. You can see the green tick or red cross on GitHub → Actions. It never deploys anything.

**What to tap to see it:**
- Delete: Profile → menu → Settings → scroll to the bottom → Delete my account → type the password (`loane1234` for seeded accounts) → Delete my account → Delete. Try it as a student with a rental in progress first — it will say to finish it.
- Filter: post a comment with "kys" in it → open the admin dashboard → Reports → it's there marked "Automatic filter".
- Checks: github.com/zackcoet/Loane-code → Actions tab.

**Fixed:**
- A message-limit test from run 3 was wrongly written (the app was fine). Found by the new GitHub checks on their very first run.

**Skipped / blocked:**
- The overnight machine still can't start the emulators — but that no longer matters, because GitHub now runs them. Tonight's final run: **258 tests passed, 0 failed.**
- Reviews and single messages can't be taken down straight from a report yet (warn/suspend still works). Logged as a suggestion.
- "Download my data" (part of C9) isn't built — only deletion is.

**🚨 NEEDS ZACK:**
- **Old usernames:** when someone deletes her account, her @handle stays reserved forever so nobody can pose as her. Instagram frees them eventually. Say if you want that.
- **"Venmo me":** asking to pay outside the app is the real scam risk, but while Stripe is off, students pay each other directly, so the filter would flag every rental chat. It's left off the list until payments run in the app.
- The word list is in `shared/src/contentFilter.ts` — have a look and add anything you or Ella want flagged.

**Next up:** C1 — list every place the app writes to the database directly and move the risky ones behind the server.

**Commits:**
- Delete my account: Settings → Delete my account, with a password and confirm step
- Content filter: flag threats and slurs in captions, comments and messages for admin review
- Admin reports: 'Take the content down' now works on a reported comment
- CI: run typecheck, lint and the emulator tests on every push and pull request
- Tests: fix two emulator tests that CI caught on its first run
- Autopilot log for run 5

---

## 2026-10-21 (run 4, ~1 AM Central) — Blocking that really works everywhere, and Mute

**Plan:** B2 — find every place a blocked person could still reach or appear, and close it: on the server (so a modified app can't get around it) and on the phone (so she just disappears). Then B3 — a softer "Mute" that hides someone's looks from your feed without blocking.

**Built:**
- **Blocking now stops old chats too.** Before tonight, if two girls already had a chat and one blocked the other, messages could still be sent in that old chat. Now the server refuses them, in both directions. Hearting a message, liking a look, and replying to someone's comment are refused too once either has blocked.
- **A blocked person disappears from:**
  - Messages — the chat leaves the inbox, Message requests, and the unread badge. If she opens it from an old link, it says "This chat isn't available" with no typing box.
  - Activity — likes, comments and follows from her are hidden, and don't count on the badge. Rental reminders (due back, handoff) still show, so nobody misses a return because of a block.
  - Her look or piece, if opened from an old link, reads "Not found", the same as a deleted one — it never says who blocked whom.
  - "Liked by @name" under a look never names her.
  - Your Liked looks, saved looks, and a piece's "Seen in posts". Saved pieces from her closet move to "no longer available".
  - (Feed, Discover, search, suggestions, comments and follower lists were already covered.)
- **Mute.** Tap the "…" on someone's look in the feed → **Mute @name**. Her looks stop showing in your feed (both tabs), and she is never told. You can still message her, rent from her and visit her closet. The "…" on her profile or in a chat now offers **Mute / Unmute** too.
- **Settings → Muted** lists everyone you've muted with an **Unmute** button.

**What to tap to see it:**
- Mute: Feed → "…" on someone else's look → Mute @name → her looks vanish from the feed. Menu → Settings → Muted → Unmute brings them back.
- Block: open a chat → "…" at the top → Block. Back in Messages the chat is gone. On her phone, the chat is gone too, and her Activity no longer shows your likes.

**Fixed:**
- The hole above: blocking didn't stop messages in a chat that already existed.
- The "who blocked me" lists are now loaded once for the whole app instead of once per screen, so the feed doesn't open dozens of copies of the same connection.

**Skipped / blocked:**
- **Emulators still can't start on the overnight machine** (Google's download site is blocked here). About 9 new security-rule tests (blocked chats, muting) are written but **not run tonight**. Type checks, lint and the shared tests (130, including new ones for hiding blocked chats and alerts) all pass.
- Muting only hides looks from the feed, like Instagram. It doesn't hide her pieces in Discover — easy to add if you want it.

**🚨 NEEDS ZACK:**
- Same as before: run `npm run emulators` then `npm test` on your laptop before anything goes live. Tonight's block check sits on the "send a message" rule.
- A small call you may want to make: if two girls are mid-rental and one blocks the other, their chat disappears (the rental itself carries on from My Rentals, and reminders still arrive). Written down in decisions.md — tell me if you'd rather the rental chat stay.

**Next up:** B4 — "Delete my account" in Settings (Apple requires it). It removes or anonymizes her data with a confirm step; it needs care around active rentals, so it gets a full run of its own.

**Commits:**
- Blocking: refuse messages, hearts, likes and comment replies between blocked people
- Blocking: hide blocked people from chats, alerts, liked and saved looks
- Mute someone: hide her looks from your feed without blocking
- Autopilot log for run 4

---

## 2026-10-21 (run 3, ~midnight Central) — Mute, delete and message requests; a send limit; report a look or a message

**Plan:** Finish the messaging list: the rest of A6 (swipe to mute/delete, message requests), A7 (a limit on how fast messages can be sent), and the two suggested extras A8 (turn "Seen" off) and A9 ("Liked a message" in the inbox). Then start Safety with B1 (report anything). Everything that could be faked by a phone is checked by the server.

**Built:**
- **Swipe a chat to mute or delete it.** In Messages, swipe a chat to the left: **Mute** and **Delete** appear. Press and hold a chat for the same choices.
  - **Mute:** the chat stays, with a little crossed-out bell, but it stops adding to your Messages badge.
  - **Delete:** the chat leaves *your* messages only — the other girl keeps hers. If either of you sends something new, it comes back showing only the new messages.
- **Message requests.** Messages from someone you don't follow, that you've never answered, now wait in a **Message requests** row at the top of Messages instead of mixing in with your friends. They don't count toward your badge. Open one and a strip says "You don't follow @name. Reply to move this chat to your messages" with a Delete button. Replying moves it into your inbox. Chats about a rental are never treated as requests, and nobody's existing chats were moved.
- **A limit on sending messages:** 500 an hour per person — far more than any real student sends, but it stops a stolen account or a script from flooding people. Sending still feels instant. Anyone who somehow hits it sees "You are sending a lot of messages. Take a short break, then try again."
- **Turn "Seen" off.** Settings → Privacy → **Show read receipts**. When off, nobody sees when you've read their messages — and, like Instagram, you don't see theirs either.
- **"Liked a message" in the inbox.** When someone hearts your message, your inbox shows "Liked a message" and it counts as one unread. Hearting over and over only counts once.
- **Report a look, or one message.** The "…" on someone else's look (in the feed or on the look's page) now opens Report. In a chat, press and hold one of *their* messages → **Report**. The report lands in the admin Reports queue with a copy of the words that were reported, so you can judge it even though chats are private. Profiles, pieces and comments could already be reported.

**What to tap to see it:**
- Messages → swipe any chat to the left → Mute (bell appears) or Delete (confirm).
- Message requests: sign in as a student who doesn't follow Ella → message Ella → sign back in as Ella → Messages → "Message requests" row at the top.
- Menu → Settings → Privacy → "Show read receipts" switch.
- In a chat, double-tap one of your friend's messages on her phone → on yours, the inbox row says "Liked a message".
- Feed → tap the "…" on someone else's look → pick a reason → Submit. Or in a chat, press and hold their message → Report. Then check the admin dashboard → Reports.

**Fixed:**
- Nothing broken found tonight.

**Skipped / blocked:**
- **Emulators still can't start on the overnight machine** (Google's download site is blocked here). About 25 new security-rules tests (mute, delete, requests, the send limit, read-receipt setting) are written but **not run tonight**. Type checks, lint and the shared tests (123, including new ones for requests, mute, delete, the send limit, receipts-off and hearts) all pass.
- No push notifications exist yet, so "Mute" only quiets the badge for now. When push is added it should skip muted chats.

**🚨 NEEDS ZACK:**
- Please run `npm run emulators` then `npm test` on your laptop **before anything from tonight goes live** — sending messages now goes through a new rule, so a mistake there would stop messages sending. If anything fails, the next run fixes it first.
- When you next deploy, the live check (`coreFlowLive.ts`) was updated to send messages the new way, so it should still say 19 passed.

**Next up:** B2 — make blocking work everywhere (feed, search, suggestions, comments, chats).

**Commits:**
- Inbox: swipe to mute or delete a chat, and message requests
- Chat: limit how fast messages can be sent (500 an hour)
- Privacy: a switch to turn read receipts off
- Inbox: 'Liked a message' when someone hearts yours
- Report a look or a single message
- Autopilot log for run 3

---

## 2026-10-21 (run 2, ~11 PM Central) — Send a piece to a friend, "Seen", hearts, inbox search

**Plan:** Finish the rest of the messaging list in order: A2 (send a listing into a chat — looks already worked), A4 ("Seen" receipts), A5 (double-tap heart), then start A6 (inbox search). Everything that could be faked by a phone is checked by the server rules.

**Built:**
- **Send a piece to a friend.** Every listing now has a paper-plane button at the top. It opens the same "Send to" screen as looks. The piece shows up in the chat as a card with its photo, name and price ("Loane It from $25 · Own It $90"). Tapping the card opens the listing. Only pieces that are up right now can be sent — not paused, sold or removed ones.
- **"Seen" and "Sent".** Under your newest message it now says "Sent", and changes to "Seen" once she's opened the chat. A chat left open in the background, or with the phone locked, doesn't count as seen.
- **Double-tap to heart a message.** A small heart appears on the bubble. Tap the heart (or press and hold → Unlike) to take it back. Double-tapping again never takes it back by accident, same as posts.
- **Inbox search.** A search box at the top of Messages finds chats by name or @username as you type.
- **Inbox rows say more:** "You: …" when you sent the last message, and how long ago (e.g. "· 2 hours ago").
- **Safety:** the app can't fake a shared piece (wrong price or name), can't say someone saw a message when they didn't, and can only add or remove its own heart. Sending looks and pieces now has a generous limit per hour so a script can't spam everyone.

**What to tap to see it:**
- Discover → open any piece → paper-plane at the top right → pick a friend → Send. You land in the chat with the card.
- Send a message, then sign in as the other student on a second phone and open the chat — the first phone changes "Sent" to "Seen".
- In any chat, double-tap a message → a heart appears. Tap the heart to remove it.
- Messages → type a name in the search box at the top.

**Fixed:**
- If a chat was left open on another screen, new messages were marked read even though nobody was looking. Now they wait until you're actually looking at the chat.

**Skipped / blocked:**
- **Emulators still can't start on the overnight machine** (Google's download site is blocked here), so the new security-rules tests (about 15 of them, for pieces, "Seen" and hearts) are written but **not run tonight**. Type checks, lint and the shared tests (95 of them, including new ones for the price on the card and the "Seen" logic) all pass.
- A6 is only partly done: search is in, but swipe-to-delete/mute and a separate "requests" folder aren't. Those need new settings saved per person and a change to notifications — better as one careful piece next run.
- No haptics (the little buzz) on the heart — that needs a new add-on that only works in a proper app build, not Expo Go.

**🚨 NEEDS ZACK:**
- Please run `npm run emulators` then `npm test` on your laptop. If any of tonight's rules tests fail, the next run will fix them first.
- A small question for later, no rush: should students be able to turn "Seen" off (Instagram lets you)? Logged as a suggestion, not built.

**Next up:** Finish A6 (swipe to delete/mute a chat, message requests from people you don't follow), then A7 (limit how fast messages can be sent).

**Commits:**
- Chat: send a piece from someone's closet to a friend
- Chat: "Seen" and "Sent" under your newest message
- Chat: double-tap a message to heart it
- Inbox: search by name, "You:" on your own last message, and when
- Autopilot log for run 2

---

## 2026-10-21 (run 1, ~10 PM Central) — Swipe to reply in chats

**Plan:** Backlog A1 — reply to one specific message. Copy the original into the reply so the quote shows instantly, and make the server rules check the copy matches the real message so nobody can fake a quote.

**Built:**
- In any chat, swipe a message to the right and it starts a reply — a small arrow appears as you drag, just like Instagram.
- A strip above the typing box says "Replying to @name" with a preview, and an × to cancel.
- The sent message shows the quoted original on top of the bubble. Tap the quote and the chat scrolls up to the original.
- Long-press a message → "Reply" does the same thing, for anyone who doesn't know the swipe. VoiceOver users get a "Reply" action too.
- If moderation later removes the original, the quote says "Message unavailable".
- Safety: the app can't put fake words in someone's mouth. The server checks every quote against the real message — same words, same person, same chat, not removed.

**What to tap to see it:** Messages → open any chat → swipe a message from left to right → type a reply → Send. Then tap the grey quote on your new message to jump back to the original. (Or press and hold a message → Reply.)

**Fixed:**
- The shared-code tests were running every test twice, and one big money check timed out on slower machines. Both fixed — no change to how money works.

**Skipped / blocked:**
- **The test emulators couldn't start on the overnight runner** — the cloud machine isn't allowed to download Google's Firestore emulator. So the security-rules tests (including the 8 new ones for replies) and the booking tests were written but **not run tonight**. Type checks, lint and the shared tests all pass. Run `npm test` with the emulators on your laptop to confirm.
- A2 (share a post *or listing* into a DM): sharing posts already exists; listings don't yet. Held for the next run rather than add more untested server code tonight.
- A3 (photos in DMs) was already built by you — marked done.

**🚨 NEEDS ZACK:**
- Please run `npm run emulators` then `npm test` once on your laptop, so tonight's new rules get checked for real. If anything fails, the next run will fix it.
- Optional: the overnight runner can't run the emulators. Setting up automatic checks on GitHub (backlog C3) would solve that for every run.

**Next up:** A2 — share a listing into a DM (posts already work), then A4 read receipts.

**Commits:**
- Shared tests: stop running each test twice, give the big money check time
- Chat: swipe a message to reply to it
- Autopilot log for this run

---

## 2026-10-20 — Setup
**Built:** Added `NORTH_STAR.md` and this log. Created the `autopilot` branch where all overnight work happens.
**What to tap to see it:** Nothing in the app yet.
**Next up:** Backlog A1 — reply to a specific message in DMs.
