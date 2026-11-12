#!/bin/bash
# One-time set-up for renewing PDFapp on the iPad automatically (scripts/ipad-renew.sh).
#   1. It reads your signing team and the app's bundle identifier from the Xcode project. Choose your
#      (Personal Team) under Signing & Capabilities in Xcode, and run the app once with ▶, before this.
#   2. It finds your iPad among the devices Xcode is paired with.
#   3. It schedules the renewal for Monday and Thursday evenings (macOS runs a missed one when the Mac wakes).
# Run from the PDFapp folder:  bash scripts/ipad-renew-setup.sh      To stop it:  bash scripts/ipad-renew-setup.sh --remove
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"
LABEL="com.bdstanley.pdfapp.renew"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
CONF="$HOME/.config/pdfapp/ipad.conf"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "The automatic renewal is switched off. (The settings in $CONF are kept.)"
  exit 0
fi

PBX="ios/App/App.xcodeproj/project.pbxproj"
TEAM=$(grep -m1 -o 'DEVELOPMENT_TEAM = [A-Z0-9]*' ios/signing.xcconfig 2>/dev/null | sed 's/.* = //' || true)
[ -n "$TEAM" ] || TEAM=$(grep -m1 -o 'DEVELOPMENT_TEAM = [A-Z0-9]*;' "$PBX" | sed 's/.* = //; s/;//' || true)
BUNDLE=$(grep -m1 -o 'PRODUCT_BUNDLE_IDENTIFIER = [^;]*;' "$PBX" | sed 's/.* = //; s/;//; s/"//g' || true)
if [ -z "$TEAM" ]; then
  echo "No signing team in the Xcode project yet."
  echo "In Xcode: click the blue App icon, then TARGETS > App > Signing & Capabilities, and choose your (Personal Team)."
  echo "Then run PDFapp on the iPad once with ▶, and run this again."
  exit 1
fi

echo "Looking for your iPad among the devices Xcode is paired with…"
JSON=$(mktemp)
xcrun devicectl list devices --json-output "$JSON" >/dev/null
DEVICE=$(node -e '
  const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.devices || [];
  const ipads = d.filter((x) => /ipad/i.test(x.hardwareProperties?.deviceType || x.deviceProperties?.name || ""));
  const pick = ipads.find((x) => x.connectionProperties?.pairingState === "paired") || ipads[0];
  if (pick) console.log(pick.identifier + "\t" + (pick.deviceProperties?.name || "iPad"));
' "$JSON")
rm -f "$JSON"
if [ -z "$DEVICE" ]; then
  echo "No iPad found. Plug it in, unlock it, trust this Mac, and run PDFapp on it once from Xcode. Then run this again."
  exit 1
fi
DEVICE_ID="${DEVICE%%$'\t'*}"
DEVICE_NAME="${DEVICE#*$'\t'}"

mkdir -p "$(dirname "$CONF")"
cat >"$CONF" <<EOF
# PDFapp on the iPad: settings for scripts/ipad-renew.sh (written by scripts/ipad-renew-setup.sh)
REPO="$REPO"
TEAM="$TEAM"
BUNDLE="$BUNDLE"
DEVICE="$DEVICE_ID"
DEVICE_NAME="$DEVICE_NAME"
EOF

mkdir -p "$(dirname "$PLIST")"
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>-lc</string><string>bash "$REPO/scripts/ipad-renew.sh"</string></array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>20</integer><key>Minute</key><integer>7</integer></dict>
    <dict><key>Weekday</key><integer>4</integer><key>Hour</key><integer>20</integer><key>Minute</key><integer>7</integer></dict>
  </array>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo
echo "Set up. PDFapp will be renewed on \"$DEVICE_NAME\" every Monday and Thursday at 20:07"
echo "(team $TEAM, app $BUNDLE). A notification says whether each renewal worked; the log is ~/Library/Logs/PDFapp-renew.log."
echo "To try it now:  bash scripts/ipad-renew.sh   (it takes a few minutes; watch for the notification)"
