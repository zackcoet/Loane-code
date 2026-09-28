# Setting up Loane

Plain steps. If a step doesn't work, that's a bug in these instructions —
tell Claude and we'll fix the doc, not just your machine.

## What you need installed

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20.x | `node -v` |
| npm | 10.x | `npm -v` |
| Firebase CLI | 13+ | `firebase --version` |
| Git | any recent | `git --version` |
| Expo Go | latest | the app on your phone |

If Node is missing or the wrong version, install it from
[nodejs.org](https://nodejs.org) (pick the 20 LTS build).

If the Firebase CLI is missing:

```bash
npm install -g firebase-tools
```

## One-time setup

**1. Get the code and install everything.**

```bash
git clone https://github.com/zackcoet/Loane-code.git
```

```bash
cd Loane-code && npm install
```

This installs all four parts at once. It takes a couple of minutes the first
time.

**2. Create the local config files.**

```bash
cp mobile/.env.example mobile/.env && cp admin/.env.example admin/.env
```

The defaults point at the local emulator and work as-is. You do **not** need
a real Firebase config to start building.

## Running it day to day

You need two or three terminal windows.

**Terminal 1 — the fake Firebase.**

```bash
npm run emulators
```

This is the Firebase Emulator Suite: a complete Firebase running on your own
laptop. It costs nothing and you cannot break anything real with it. Leave it
running. The dashboard is at http://localhost:4000.

**Terminal 2 — fill it with test data.**

```bash
npm run seed
```

This creates the University of South Carolina, 10 students, 32 listings, 18
posts, and a pile of follows and likes, so the app looks alive while we build.

Every seeded account uses the password **`loane1234`**:

- A student: `ellapetrickcloset@email.sc.edu`
- The admin: `admin@joinloane.com`

Re-run it any time you want a clean slate. It wipes and rebuilds.

**Terminal 3 — the app.**

```bash
npm run mobile
```

A QR code appears. Open the **Camera app** on your iPhone, point it at the QR
code, and tap the banner — it opens in Expo Go. (On Android, scan it from
inside the Expo Go app.)

### Getting it working on a real phone

There are **two** separate things that have to be right. Getting one and
not the other is the usual cause of "no connection" on the phone while
everything looks fine on the laptop.

**1. The app has to know your laptop's address.**

To your phone, "localhost" means *the phone*. Run:

```bash
npm run lan
```

That finds your Wi-Fi address and writes it into `mobile/.env`. Restart
the app afterwards.

**Your laptop's address changes** when you switch networks, and sometimes
when the router feels like it. If the phone suddenly stops connecting,
run `npm run lan` again — that is almost always the fix.

**2. The emulators have to accept connections from other devices.**

By default the Firebase emulators listen on `127.0.0.1` only, which means
they refuse anything that is not the laptop itself. Your phone can have
exactly the right address and still get nothing.

`backend/firebase.json` sets `"host": "0.0.0.0"` on each emulator, which
means "listen on every network interface". You can confirm it:

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(8080|9099|5001|9199) '
```

You want to see `*:8080`. If it says `127.0.0.1:8080`, the emulators need
restarting.

> **Where this is safe.** `0.0.0.0` means anyone on the same Wi-Fi can
> reach your emulators. On your home network that is fine. On open campus
> or coffee-shop Wi-Fi, anyone on that network could read and write your
> local test data. It is a `demo-` project with fake students in it, so
> the worst case is someone spoiling your seed — but do not leave it
> running on a public network, and never point this at a real project.

(In the iOS Simulator none of this matters — it shares the laptop's
network, so `127.0.0.1` works.)

### Still not connecting?

Work down this list:

| Check | How |
|---|---|
| Same Wi-Fi? | Phone and laptop, same network. A phone on cellular will never reach it. |
| Right IP? | `npm run lan`, then restart the app |
| Emulators listening widely? | `lsof` command above — want `*:8080`, not `127.0.0.1:8080` |
| Mac firewall blocking? | System Settings → Network → Firewall. If it is on, allow incoming for `node` and `java`, or turn it off on a trusted network |
| Wi-Fi isolating clients? | See below |

**Client isolation** is the one that catches people out. Many public and
university networks deliberately stop devices talking to each other, so
your phone cannot reach your laptop no matter what either is configured
to do. Guest networks almost always do this.

You can test it from the phone's browser: open
`http://YOUR_IP:4000`. If the emulator dashboard loads, the network is
fine and the problem is configuration. If it times out, the network is
blocking you.

**Ways round it:** use a home network or a personal hotspot from your
phone (with the laptop joined to it), or test in the iOS Simulator
instead.

**The admin dashboard** (a fourth terminal, when you want it):

```bash
npm run admin
```

Then open http://localhost:5173 and sign in as `admin@joinloane.com`.

## Running the tests

The tests need the emulators running first (Terminal 1 above). Then:

```bash
npm test
```

This checks the two things that matter most: that the security rules actually
stop someone faking a follower count or writing a booking, and that ten
simultaneous requests for the same dress produce exactly one booking.

## Other useful commands

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run format
```

## Granting someone admin access

Admin is a Firebase custom claim, not a database field. On the emulator:

```bash
npm run grant-admin --workspace @loane/functions -- someone@joinloane.com
```

They have to sign out and back in for it to take effect.

## Deploying

**Read this before deploying anything.**

There are three Firebase project names in `backend/.firebaserc`:

| Alias | Project | Rule |
|---|---|---|
| `demo` | `demo-loane` | Not real. Local emulators only. This is the default. |
| `dev` | `loane-dev` | Our development project. Safe to deploy to. |
| `prod` | `loane-code` | **The real one. Something is already on its Hosting.** |

Never deploy to `prod` without asking Zack. Nothing in this repo deploys to
Hosting at all.

To deploy rules and functions to the dev project:

```bash
cd backend && firebase deploy --only firestore:rules,storage:rules,functions --project dev
```

## If something goes wrong

**"Port already in use" when starting the emulators.**
An old copy is still running.

```bash
pkill -f "firebase emulators"
```

**The app loads but nothing happens / it hangs on a spinner.**
Almost always the emulator host. Check `EXPO_PUBLIC_EMULATOR_HOST` in
`mobile/.env` matches your laptop's current wi-fi IP — it changes when you
switch networks.

**Metro cache weirdness after changing a config file.**

```bash
npm run start:clear --workspace @loane/mobile
```

**A fresh start, if node_modules gets into a strange state.**

```bash
rm -rf node_modules */node_modules backend/functions/node_modules && npm install
```

---

## Deploying to a real Firebase project

### The trap that cost us a day

`backend/functions/package.json` must NOT list `@loane/shared` under
`dependencies`. It is a workspace package that exists only inside this
repo, and Firebase uploads the `backend/functions` folder on its own —
so Cloud Build runs `npm install` in a container where `@loane/shared`
cannot be resolved from any registry, the build fails, and you get
function records with no Cloud Run service behind them. The symptom is
maddening: `firebase deploy` reports success, `firebase functions:list`
shows every function, and every call returns 404.

`build.mjs` already bundles the shared code into `lib/index.js` with
esbuild, so it is a build-time dependency only. It belongs in
`devDependencies`, which Firebase does not install in the container.

### Indexes

The emulator does not validate `firestore.indexes.json` and happily
serves queries with no index behind them. Real Firestore does neither.
Two things to know:

- a single-field index is rejected outright — Firestore builds those
  itself
- every `where` + `orderBy` combination needs a composite index
  declared, or the query fails in production while working perfectly on
  your laptop

After adding any query, add its index.

### Order of operations

```bash
# 1. rules, indexes and storage — these work on the free plan
cd backend && npx firebase-tools deploy \
  --only firestore:rules,firestore:indexes,storage --project <id>

# 2. functions — needs the Blaze plan
npx firebase-tools deploy --only functions --project <id>

# 3. the campus document and an admin, without which signup rejects
#    everybody and the dashboard is unusable
cd functions && npx tsx scripts/bootstrapProject.ts \
  --project <id> --admin you@example.com

# 4. the functions service account needs to mint custom tokens
gcloud iam service-accounts add-iam-policy-binding \
  <project-number>-compute@developer.gserviceaccount.com \
  --member="serviceAccount:<project-number>-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" --project <id>
```

`bootstrapProject.ts` deliberately does not load the fake students that
`seed.ts` makes. Those belong in an emulator, never in front of real
users.

### If a deploy leaves functions in UNKNOWN or FAILED

They cannot be updated in place, and a function that was registered as
HTTPS cannot become a background trigger. Delete them and deploy again:

```bash
npx firebase-tools functions:delete <names...> \
  --project <id> --region us-central1 --force
```

## EAS build profiles

- **development** — a dev client that still talks to the emulators on
  your laptop over Wi-Fi. For working on native modules.
- **preview** — a standalone app installed from a link, pointed at the
  live backend. This is the one to test on a real phone.
- **production** — the TestFlight / App Store build.

The Firebase web config in `eas.json` is not a secret. It identifies the
project; the security rules are what grant access. See docs/security.md.

First iOS build needs an interactive run, because it signs into the
Apple Developer account:

```bash
cd mobile
npx eas-cli device:create                        # register your iPhone
npx eas-cli build --platform ios --profile preview
```
