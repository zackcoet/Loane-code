# What push notifications will need

Nothing in this file is built. It is the list of what has to happen
once we make a development build, written while the in-app versions
were being built so the shape is not guessed at later.

**Why none of this exists yet:** push notifications do not work in Expo
Go. They need a development build, which is a deliberate step we have
not taken. Every alert below already exists IN THE APP — this is only
about making the phone buzz when Loane is closed.

## The gap that matters

Two features are currently making promises the app cannot keep when it
is closed:

| Promise | Why in-app is not enough |
|---|---|
| **Same-day: "she has 2 hours to answer"** | The whole point is speed. A lender who opens Loane that evening has already missed it, and the request auto-declines. **This is the one that is nearly useless without push.** |
| **24-hour response on a normal request** | Survivable — a day is long enough that she will probably open the app anyway — but the auto-decline still lands as a surprise. |
| Drop off today / return tomorrow | A reminder nobody sees on the morning it matters is not a reminder. |

## What has to be built

1. **A development build.** `eas build --profile development`. Expo Go
   cannot register for push at all, so nothing below can be tested
   until this exists.

2. **Permission, asked at the right moment.** Not on first launch —
   asked the first time she does something that creates an expectation:
   sends a rental request, or turns on same-day. A student who has been
   asked cold almost always says no, and iOS only lets you ask once.

3. **Store the token.** `User.pushTokens` already exists and is
   app-writable, one entry per device. Register on sign-in, and clear
   on sign-out so somebody else's phone does not keep receiving her
   rentals.

4. **Send from the existing `notify()`.** Every alert in the app
   already goes through one function in
   `backend/functions/src/bookings/transitions.ts`. Push is a second
   send inside it, not a second system — which is the reason to do it
   there and nowhere else.

5. **Honour her preferences.** `UserPrivate.notificationPreferences`
   already has `pushEnabled`, `rentals`, `social`, `messages` and
   `marketing`. They are written and respected by nothing today.

6. **Expo's push service**, since we are on Expo: POST to
   `exp.host/--/api/v2/push/send` with the stored ExpoPushToken.
   Receipts have to be read back — a token can go stale and Expo only
   tells you on the receipt, not the send.

## Which alerts become push, in priority order

| Alert | Who | Why it is on this list |
|---|---|---|
| Same-day request | lender | 2-hour window. Useless without push. |
| Rental request | lender | 24-hour window, auto-declines. |
| Request accepted / declined | renter | She is waiting on an answer. |
| Drop off today | lender | Time-critical, and somebody is waiting. |
| Return today / tomorrow | renter | Avoids a late return and a bad review. |
| Request expiring in 2 hours | lender | A nudge before the auto-decline. |
| New message | both | Table stakes once handoffs are arranged in chat. |
| Review request | both | Low priority. Fine as in-app only. |

## What NOT to push

Likes, follows, comments and suggested closets. They are social noise
and the fastest way to get the whole category muted — which would take
the rental alerts with them. `notificationPreferences.social` exists so
this can be revisited, but the default should stay off.
