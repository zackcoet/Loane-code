# Autopilot Log

Plain-English record of every autonomous run. Newest entry at the top. Rules and backlog live in [`NORTH_STAR.md`](../NORTH_STAR.md).

## 🚨 NEEDS ZACK
- Run the emulator tests once on your laptop to confirm tonight's chat-reply rules (see the 2026-10-21 entry).

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
