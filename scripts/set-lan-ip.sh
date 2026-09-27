#!/usr/bin/env bash
#
# Point the app at this laptop's current Wi-Fi address.
#
#   npm run lan
#
# Your laptop's IP changes when you switch networks — home to campus,
# campus to a coffee shop — and when the router hands out a new one. When
# that happens the app on your phone stops reaching the emulators and
# says "no connection". Run this, then restart the app.

set -euo pipefail

IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [ -z "$IP" ]; then
  IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi

if [ -z "$IP" ]; then
  echo "Could not find a Wi-Fi address. Are you connected?"
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
ENV_FILE="$ROOT/mobile/.env"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/mobile/.env.example" "$ENV_FILE"
  echo "Created mobile/.env from the example."
fi

# Replace the line if it exists, add it if it does not.
if grep -q '^EXPO_PUBLIC_EMULATOR_HOST=' "$ENV_FILE"; then
  # A temp file keeps this working the same on macOS and Linux sed.
  tmp="$(mktemp)"
  sed "s|^EXPO_PUBLIC_EMULATOR_HOST=.*|EXPO_PUBLIC_EMULATOR_HOST=$IP|" "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
else
  printf '\nEXPO_PUBLIC_EMULATOR_HOST=%s\n' "$IP" >> "$ENV_FILE"
fi

echo "Your laptop is $IP on this network."
echo "mobile/.env updated."
echo ""
echo "Now restart the app so it picks it up:"
echo "  npm run mobile"
