#!/usr/bin/env bash
#
# Point the phone app at the practice backend or at the live one.
#
#   npm run practice   the Firebase emulators on this laptop, with the
#                      seeded USC campus — fake students, fake closets,
#                      fake posts. Nothing you do leaves the machine and
#                      no email is ever sent.
#
#   npm run live       the real loane-code project. Real accounts, real
#                      database, real verification emails from Gmail.
#
# It rewrites three lines in mobile/.env. Everything else in that file
# is left alone.
#
# RESTART METRO AFTER SWITCHING. EXPO_PUBLIC_* values are baked into the
# bundle when it is built, so a running dev server keeps serving the old
# one — which looks exactly like the switch not working.

set -euo pipefail

MODE="${1:-}"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/mobile/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "No mobile/.env. Copy mobile/.env.example to mobile/.env first."
  exit 1
fi

# The live project's web config. NOT a secret: it identifies the
# project, it does not grant access — the security rules do that. The
# same values are already in mobile/eas.json.
LIVE_API_KEY="AIzaSyAL5iE73tRc9YbY7jGWya65Q8Pl_Kd831M"
LIVE_AUTH_DOMAIN="loane-code.firebaseapp.com"
LIVE_PROJECT_ID="loane-code"
LIVE_BUCKET="loane-code.firebasestorage.app"
LIVE_SENDER_ID="384488190763"
LIVE_APP_ID="1:384488190763:web:13e9baa2efd0b10815cb6e"

# The emulators do not check any of this, so the values only have to be
# shaped like Firebase config. A demo- project id is what makes the
# emulator refuse to reach a real service by accident.
DEMO_PROJECT_ID="demo-loane"

set_key() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # A temp file, because sed -i differs between macOS and Linux.
    awk -v k="$key" -v v="$value" \
      'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' \
      "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

case "$MODE" in
  live)
    set_key EXPO_PUBLIC_USE_EMULATORS false
    set_key EXPO_PUBLIC_FIREBASE_API_KEY "$LIVE_API_KEY"
    set_key EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN "$LIVE_AUTH_DOMAIN"
    set_key EXPO_PUBLIC_FIREBASE_PROJECT_ID "$LIVE_PROJECT_ID"
    set_key EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET "$LIVE_BUCKET"
    set_key EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "$LIVE_SENDER_ID"
    set_key EXPO_PUBLIC_FIREBASE_APP_ID "$LIVE_APP_ID"
    echo ""
    echo "  LIVE — loane-code."
    echo ""
    echo "  Real accounts. Real database. Real emails."
    echo "  Anything you create here is real and stays."
    echo ""
    ;;
  practice)
    set_key EXPO_PUBLIC_USE_EMULATORS true
    set_key EXPO_PUBLIC_FIREBASE_PROJECT_ID "$DEMO_PROJECT_ID"
    echo ""
    echo "  PRACTICE — the emulators on this laptop."
    echo ""
    echo "  Run them with:  npm run emulators"
    echo "  Fill them with: npm run seed"
    echo ""
    ;;
  *)
    echo "Usage: npm run live   |   npm run practice"
    exit 1
    ;;
esac

echo "  Now restart Metro (Ctrl+C, then npm run mobile) — the old value"
echo "  is baked into the running bundle."
echo ""
