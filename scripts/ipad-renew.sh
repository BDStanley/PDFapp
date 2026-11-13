#!/bin/bash
# Renews PDFapp on the iPad and the iPhone: fetches the latest version, builds it signed with your Apple ID, and installs it
# over Wi-Fi (or the cable), so the 7-day limit of a free Apple ID never runs out.
# Run by the schedule that scripts/ipad-renew-setup.sh sets up; can also be run by hand:  bash scripts/ipad-renew.sh
# Settings (your signing team, the app's bundle identifier and the iPad) are in ~/.config/pdfapp/ipad.conf.
# Log: ~/Library/Logs/PDFapp-renew.log
set -uo pipefail

CONF="$HOME/.config/pdfapp/ipad.conf"
LOG="$HOME/Library/Logs/PDFapp-renew.log"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo
echo "=== $(date '+%Y-%m-%d %H:%M:%S') renewing PDFapp"

notify() { osascript -e "display notification \"$2\" with title \"PDFapp\" subtitle \"$1\"" >/dev/null 2>&1 || true; }
fail() {
  echo "FAILED: $1"
  notify "PDFapp was not renewed" "$1 See ~/Library/Logs/PDFapp-renew.log."
  exit 1
}

[ -f "$CONF" ] || fail "Run scripts/ipad-renew-setup.sh first."
# shellcheck source=/dev/null
source "$CONF"
DEVICES="${DEVICES:-${DEVICE:-}}" # settings written before the iPhone was added name one DEVICE
[ -n "${TEAM:-}" ] && [ -n "${BUNDLE:-}" ] && [ -n "$DEVICES" ] && [ -n "${REPO:-}" ] || fail "The settings in $CONF are incomplete. Run scripts/ipad-renew-setup.sh again."
cd "$REPO" || fail "The PDFapp folder $REPO was not found."

# The latest version. If the team you chose in Xcode, or npm's lock-file edits, are in the way of an update,
# they are dropped: the build below sets the team itself.
if ! git pull --ff-only; then
  git checkout -- ios/App/App.xcodeproj/project.pbxproj package-lock.json 2>/dev/null || true
  git pull --ff-only || echo "Could not fetch the latest version; renewing the version already here."
fi
npm install --no-audit --no-fund || fail "npm install failed."
node scripts/build-web.js || fail "Building the web part failed."
npx cap sync ios || fail "Capacitor sync failed."

# Build, signed with your personal team (the account added in Xcode's settings).
BUILD="$REPO/ios/App/build-renew"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS' -derivedDataPath "$BUILD" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE" build \
  | grep -E "error:|warning: .*sign|BUILD (SUCCEEDED|FAILED)" || true
APP="$BUILD/Build/Products/Debug-iphoneos/App.app"
[ -d "$APP" ] || fail "The build failed (signing, or a code error)."

# Install on each device: over Wi-Fi when it is on the same network as the Mac, or by cable. One build serves
# both, since the app is universal.
OK=0; MISSED=0
for D in $DEVICES; do
  if xcrun devicectl device install app --device "$D" "$APP"; then OK=$((OK + 1)); else MISSED=$((MISSED + 1)); echo "Could not reach device $D."; fi
done
[ "$OK" -gt 0 ] || fail "No device could be reached. Are they on the same Wi-Fi as the Mac, and unlocked?"

echo "Renewed on $OK device(s): PDFapp $(defaults read "$APP/Info.plist" CFBundleShortVersionString 2>/dev/null) is good until $(date -v+7d '+%e %B')."
if [ "$MISSED" -gt 0 ]; then
  notify "Renewed on $OK of $((OK + MISSED)) devices" "One could not be reached; it runs until its last renewal's 7 days are up. See the log."
else
  notify "Renewed" "PDFapp is good for another 7 days."
fi
