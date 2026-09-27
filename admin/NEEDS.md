# Admin Dashboard Backend Needs

These are intentionally not built in `admin/` because they need server authority, security rules, and audit logging. The dashboard shows the screens/buttons now, but the actions should be wired through Cloud Functions later.

## Suspend and unsuspend users

Need a callable Cloud Function that only admins can call.

Plain-English reason: a student account status is a trust field. The browser should not directly edit `users/{uid}.status`, `suspendedReason`, or `suspendedUntil`, even from the admin panel. The function should update the user and write an `adminActions` audit row with who did it, when, and why.

## Hide and restore listings

Need a callable Cloud Function for listing moderation.

Plain-English reason: hiding a listing changes marketplace availability and trust state. The function should set the listing to `suspended` or restore it, preserve the reason, and write an `adminActions` row. Direct Firestore writes from the dashboard would skip the audit trail.

## Hide and restore posts

Need a callable Cloud Function for post moderation.

Plain-English reason: posts are part of the social feed, and moderation needs a permanent record. The function should set the post to `suspended` or restore it, preserve the reason, and write an `adminActions` row.

## Resolve reports

Need a callable Cloud Function to move reports through `open`, `reviewing`, `actioned`, and `dismissed`.

Plain-English reason: reports can reveal sensitive reporter information and may result in user or content penalties. The server should enforce which admin can resolve them and write an audit row.

## Resolve damage claims

Need a callable Cloud Function to decide damage claims and record awarded cents.

Plain-English reason: damage claims affect money and trust. Even before payments are live, the decision path should be server-owned so the later Stripe work has a safe source of truth.

## Internal admin notes

Need a private admin-only collection or subcollection for notes, likely with documents tied to a user id.

Plain-English reason: notes may contain sensitive operational context. They should be readable only by admins, writeable only by admins, and every create/update should write or update an audit trail.

## Admin activity log population

Need every admin Cloud Function to write to `adminActions`.

Plain-English reason: the Activity Log screen already reads `adminActions`, but it will stay empty until server-side admin actions write into it. This is how Loane can answer “who changed this, when, and why?”

## Aggregated analytics for scale

Need scheduled or callable aggregation for dashboard metrics once event volume grows.

Plain-English reason: the current admin dashboard reads emulator-sized collections directly, which is fine for buildout and early testing. At real scale, overview charts, funnels, and retention should read precomputed daily/weekly rollups instead of scanning every event and user document.
