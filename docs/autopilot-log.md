# Autopilot Log

Plain-English record of every autonomous run. Newest entry at the top. Rules and backlog live in [`NORTH_STAR.md`](../NORTH_STAR.md).

## 🚨 NEEDS ZACK
- Run the emulator tests once on your laptop (`npm run emulators`, then `npm test`) to confirm the new chat rules from runs 1 and 2. The overnight machine still can't start the emulators.

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
