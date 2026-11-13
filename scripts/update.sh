#!/bin/bash
# Brings this app up to date and opens it in Xcode, without ever clashing with your own settings:
#   1. Your signing team lives in ios/signing.xcconfig, which git ignores. If Xcode has written the team
#      into the project file instead (choosing a team under Signing & Capabilities does that), the team is
#      moved to ios/signing.xcconfig and Xcode's edit to the project file is undone, so `git pull` never
#      refuses with "Your local changes ... would be overwritten".
#   2. npm's own edits to package-lock.json are dropped for the same reason.
#   3. It pulls, installs and opens Xcode.
# Run from the app's folder:  bash scripts/update.sh
# (In a checkout that does not have this script yet:  git fetch && bash <(git show origin/main:scripts/update.sh))
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PBX="ios/App/App.xcodeproj/project.pbxproj"
LOCAL="ios/signing.xcconfig"

TEAM=""
[ -f "$LOCAL" ] && TEAM=$(grep -m1 -o 'DEVELOPMENT_TEAM = [A-Z0-9]*' "$LOCAL" | sed 's/.* = //' || true)
[ -n "$TEAM" ] || TEAM=$(grep -m1 -o 'DEVELOPMENT_TEAM = [A-Z0-9]*;' "$PBX" 2>/dev/null | sed 's/.* = //; s/;//' || true)
if [ -z "$TEAM" ]; then
  # The team of the Apple Development certificate Xcode made for your Apple ID (its OU is the team).
  TEAM=$(security find-certificate -c "Apple Development" -p 2>/dev/null | openssl x509 -noout -subject 2>/dev/null | sed -n 's/.*OU *= *\([A-Z0-9]\{10\}\).*/\1/p' | head -1 || true)
fi
if [ -n "$TEAM" ]; then
  echo "DEVELOPMENT_TEAM = $TEAM" > "$LOCAL"
  echo "Signing team: $TEAM (kept in $LOCAL, which git ignores)."
else
  echo "No signing team found yet: in Xcode choose your (Personal Team) once, then run this again."
fi

# Undo Xcode's edits to the project file (the team now lives in ios/signing.xcconfig) and npm's to the lock file.
if ! git diff --quiet -- "$PBX"; then
  if git diff -U0 -- "$PBX" | grep '^[+-][^+-]' | grep -qv 'DEVELOPMENT_TEAM\|DevelopmentTeam\|ProvisioningStyle\|CODE_SIGN_STYLE\|CODE_SIGN_IDENTITY\|PROVISIONING_PROFILE\|TargetAttributes\|CreatedOnToolsVersion\|LastSwiftMigration'; then
    echo "The Xcode project has changes besides the signing team; they are set aside with git stash (git stash list to see them)."
    git stash push -m "Xcode project changes set aside by scripts/update.sh" -- "$PBX"
  else
    git checkout -- "$PBX"
  fi
fi
git checkout -- package-lock.json 2>/dev/null || true

git pull --ff-only
npm install --no-audit --no-fund
npm run ios:open
echo
echo "In Xcode: choose the iPad or iPhone at the top and press ▶. There is no need to choose a team any more."
