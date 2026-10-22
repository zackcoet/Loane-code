# Production ops — backups, spending alerts, error alerts

**Status: written, NOT done.** Nothing on this page has been switched on.
Every step touches the live project `loane-code` and some cost money, so
each one is Zack's call (NORTH_STAR C10). Do them in this order; the whole
list takes about 30 minutes in a web browser, no code.

All steps are in the Google Cloud Console (console.cloud.google.com) with
the project picker at the top set to **loane-code**. The same project shows
up in the Firebase console — they are one project with two dashboards.

---

## 1. Spending alerts (do this first — free)

A budget alert does not stop spending; it emails you when spending passes a
line, so a runaway bill is caught in hours instead of at month end.

1. Console → **Billing** → **Budgets & alerts** → **Create budget**.
2. Scope: project **loane-code**, all services.
3. Amount: **$25 / month** to start (we expect a few dollars before launch).
4. Alert thresholds: **50%, 90%, 100%**, plus **100% forecasted**.
5. Recipients: billing admins (that's you) — add Ella if she should see it.

Revisit the number at launch; a real campus will cost more than an empty
one, and an alert that fires every month gets ignored.

## 2. Daily database backups (costs cents)

Firestore can keep a copy of the whole database every day. If a bug or a
bad script deletes data, we restore from yesterday's copy.

1. Console → **Firestore** → **Disaster recovery** (or **Backups**).
2. **Create schedule** → **Daily**, retention **7 days**.
3. Optionally add **Weekly**, retention **8 weeks** — for "something went
   wrong two weeks ago and nobody noticed".

Also turn on **Point-in-time recovery** on the same page (lets us rewind
the database to any minute in the last 7 days). It roughly doubles the
storage bill for the database, which at our size is cents.

Cost at our size: well under $1/month. Test a restore once, into a
separate database name, so we know it works before we need it.

**Photos are separate.** Backups cover the database only — photos live in
Cloud Storage. Turn on **Soft delete** for the storage bucket (Console →
Cloud Storage → bucket → **Protection** → soft delete, 7 days) so a deleted
photo can be recovered for a week.

## 3. Error alerts (free at our size)

Every unexpected server failure now writes one structured log line with a
six-character code the student also sees (see `docs/decisions.md`,
"Every callable goes through one safety net"). Google groups these
automatically; this makes sure someone hears about them.

1. Console → **Error Reporting** → it should already list errors from Cloud
   Functions. Click **Turn on notifications** (bell icon) → email.
   You'll get one email when a *new kind* of error appears, not one per
   occurrence.
2. Console → **Monitoring** → **Alerting** → **Create policy**:
   - Metric: our functions are 2nd generation, so they appear as Cloud
     Run services — **Cloud Run Revision → Request count**, filtered to
     `response_code_class = 5xx` (server failures, not her mistakes).
   - Condition: more than **20 in 10 minutes**.
   - Notify: email.
   This catches "something is failing for everybody", like the booking
   sweep that crashed for weeks on a missing index.
3. Same page, a second policy: **Cloud Scheduler → job failed**, any count.
   Three jobs run on a timer (`sweepBookings` hourly, `publishScheduledPosts`,
   `sweepUnsavedTryOns`); this tells us the moment one stops working.

**Finding an error from a screenshot:** Console → **Logging** → search for
the six-character code (e.g. `3f9a1c`). One line comes back with which
function failed, for which student, and why.

## 4. App crash reports (needs a decision first)

The app is wired for a crash reporter but it is **switched off**
(`mobile/src/monitoring/crashReporter.ts`). Sentry's free tier (5,000
errors/month) is the usual choice. It needs a sign-up and a development
build of the app (not Expo Go). Turning it on is one file once you decide.

---

## After any deploy

Unchanged from `CLAUDE.md`: after any deploy that touches functions, rules
or indexes, run the live core flow and expect `19 passed, 0 failed`.
