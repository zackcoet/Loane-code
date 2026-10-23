# App Store privacy form — what Loane collects

Apple asks every app to fill in a "privacy nutrition label" in App Store
Connect (App Privacy → Data Types). This page is the answer sheet: every
kind of data the app collects, what it is for, whether it is tied to her
account, and whether it is used to track her.

Written from the code on 2026-10-23 (autopilot run 23). **If a feature
starts collecting something new, update this page in the same change.**
Filling in the actual form in App Store Connect is Zack's job — nothing
here has been submitted.

## The short answers Apple asks first

| Question                                                                                                    | Answer             | Why                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do you collect data?                                                                                        | **Yes**            | Accounts, photos, messages, rentals.                                                                                                                                               |
| Is any data used to **track** her (linked with other companies' data for ads, or shared with data brokers)? | **No**             | No ads, no ad SDKs, no advertising ID, no data sold or shared for ads. Apple's tracking prompt (ATT) is not needed.                                                                |
| Is the data **linked to her identity**?                                                                     | **Yes, all of it** | Everything is stored under her account.                                                                                                                                            |
| Third-party analytics?                                                                                      | **No**             | Usage events go to our own database, not to Google Analytics, Mixpanel, etc.                                                                                                       |
| Third-party crash reporting?                                                                                | **Not yet**        | The crash reporter is built but switched off (`mobile/src/monitoring/crashReporter.ts`). **When Sentry or similar is switched on, add "Crash Data" and "Performance Data" below.** |

## Data types, in Apple's categories

For every row: **Linked to user: Yes. Used for tracking: No.**

| Apple category → type                      | What Loane stores                                                                                                                | Purpose (Apple's words)                               | Where in the code                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Contact Info → **Name**                    | First name, display name                                                                                                         | App Functionality                                     | `users/{uid}`                                      |
| Contact Info → **Email Address**           | Login email and campus email (`@email.sc.edu`)                                                                                   | App Functionality (sign-in, proving she's a student)  | `users/{uid}/private/settings`                     |
| Contact Info → **Phone Number**            | Optional. Shared with the other student only once a rental is agreed; a scrambled copy (hash) lets friends find her              | App Functionality                                     | `private/settings.phone`, `phoneHashes`            |
| User Content → **Photos or Videos**        | Profile photo, photos of looks and listed pieces, photos sent in messages                                                        | App Functionality                                     | Cloud Storage                                      |
| User Content → **Other User Content**      | Bio, captions, comments, piece names and descriptions, reviews, reports she files, handoff notes                                 | App Functionality                                     | `posts`, `listings`, `reviews`, `reports`          |
| User Content → **Emails or Text Messages** | Direct messages between students                                                                                                 | App Functionality                                     | `chats/{id}/messages`                              |
| Identifiers → **User ID**                  | Her account id and @username                                                                                                     | App Functionality                                     | everywhere                                         |
| Usage Data → **Product Interaction**       | Taps, views, likes, saves, searches, time a look was on screen — the "events"                                                    | Analytics, Product Personalization (the For You feed) | `events`, see `docs/feed-algorithm.md`             |
| User Content → **Customer Support**        | Messages she sends from Help → Contact us, and the topic                                                                         | App Functionality                                     | `supportRequests`                                  |
| Purchases → **Purchase History**           | Rentals and purchases she made or received (dates, piece, price in cents)                                                        | App Functionality                                     | `bookings`                                         |
| Other Data → **Other Data Types**          | Clothing sizes (optional, hidden unless she turns "Show my sizes" on); "Get started" answers (rent/lend/both, occasions); campus | App Functionality, Product Personalization            | `users/{uid}.sizes`, `private/settings.onboarding` |
| Identifiers → **Device ID**                | Push notification token (only if she allows notifications)                                                                       | App Functionality                                     | `users/{uid}.pushTokens`                           |

### Not collected — answer "No" for these

- **Location** (precise or coarse). Campus comes from her email, not GPS.
- **Search History.** The `search` event records only how many letters
  she typed, never the words. Her recent-search list stays on her phone.
  If the words are ever logged, move this to "collected".
- **Contacts.** _Careful with this one._ "Find friends from contacts" reads
  phone numbers on her phone, scrambles each one there, and sends only the
  scrambled versions to be compared. The server writes nothing down —
  `backend/functions/src/social/matchContacts.ts` has no code path that
  saves them. Apple counts data as "collected" only when it is kept longer
  than needed to answer the request in real time, so this is **not
  collected**. The permission prompt in `app.json` says the same.
- **Health & Fitness, Sensitive Info, Browsing History, Diagnostics,
  Audio, Gameplay, Advertising Data.**
- **Financial Info / Payment Info.** Payments are switched off. **When
  Stripe is switched on:** card numbers go to Stripe, never to us — Apple
  still wants "Payment Info" ticked if a third party collects it inside
  the app, so add it then, purpose App Functionality.
- **Body photo for AI Try-On.** Try-On is switched off. **If it is ever
  switched on:** add "Photos or Videos" purpose App Functionality for the
  body photo (it already appears above for other photos) and mention it
  goes to the try-on provider.

## Things Apple also checks

- **Account deletion in the app:** yes — Settings → Delete my account.
- **Data download:** Settings → Download my data.
- **Privacy policy URL:** required on the App Store listing. The text
  lives in the app's legal documents; Zack must give App Store Connect the
  public web address for it (**NEEDS ZACK** when submitting).
- **Permission prompts** (`mobile/app.json`): Photos, Camera, Contacts —
  each one says why in plain words. Camera's second prompt mentions Try-On
  and only appears if Try-On is switched on.
