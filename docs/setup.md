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

### Important: your phone cannot see "localhost"

To your phone, "localhost" means the phone itself. So when you run on a real
device you must tell the app your laptop's address on the wi-fi network.

Find it:

```bash
ipconfig getifaddr en0
```

Then put that value in `mobile/.env`:

```
EXPO_PUBLIC_EMULATOR_HOST=192.168.1.42
```

Restart the app after changing it. Your phone and laptop must be on the same
wi-fi.

(In the iOS Simulator this is not needed — `127.0.0.1` works there.)

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
