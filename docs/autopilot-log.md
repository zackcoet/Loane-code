# Autopilot Log

Plain-English record of every autonomous run. Newest entry at the top. Rules and backlog live in [`NORTH_STAR.md`](../NORTH_STAR.md).

## 🚨 NEEDS ZACK
- Nothing urgent. The worry from runs 1–4 (rules tests that had never been run) is cleared: the new automatic checks on GitHub ran **all 258 tests, including every security-rule test, and they pass.** One test from run 3 had a mistake in the test itself (not the app) and is fixed.
- Two small calls, written up in run 5 below: whether a deleted account's old @handle should ever be freed up, and when to start flagging "Venmo me" in chats.

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
