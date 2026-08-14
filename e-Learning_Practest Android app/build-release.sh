#!/usr/bin/env bash
# Build a PRODUCTION release of the Practest Android app with the LIVE API URL
# baked in, so a shipped build can never silently point at a dev server.
#
#   ./build-release.sh          # -> app-release.aab  (upload to Google Play)
#   ./build-release.sh apk      # -> app-release.apk   (side-load / device test)
#
# Requires Flutter on PATH (or set FLUTTER_BIN). For a Play-signable artifact,
# android/key.properties must be present; without it the build is debug-signed —
# testable on a device but rejected by Google Play.
set -euo pipefail

# Single source of truth for the production API base URL.
API_URL="https://api.practest.live/api"

FLUTTER="${FLUTTER_BIN:-flutter}"
command -v "$FLUTTER" >/dev/null 2>&1 || {
  echo "flutter not found. Add it to PATH or set FLUTTER_BIN." >&2; exit 1;
}

FORMAT="${1:-aab}"
if [ "$FORMAT" = "aab" ]; then TARGET="appbundle"; OUT="build/app/outputs/bundle/release/app-release.aab";
elif [ "$FORMAT" = "apk" ]; then TARGET="apk"; OUT="build/app/outputs/flutter-apk/app-release.apk";
else echo "usage: $0 [aab|apk]" >&2; exit 2; fi

echo "Building $TARGET (release) against $API_URL"
"$FLUTTER" build "$TARGET" --release --dart-define=API_BASE_URL="$API_URL"

echo
echo "Done -> $OUT"
if [ ! -f android/key.properties ]; then
  echo "WARNING: android/key.properties missing - this artifact is DEBUG-signed and Google Play will reject it. See android/key.properties.example." >&2
fi
