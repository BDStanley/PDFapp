#!/bin/bash
# Builds an unsigned PDFapp.ipa for AltStore, which signs it with your Apple ID when it installs it.
# Run on a Mac with Xcode, from the repository folder:  npm run ios:ipa
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build-web.js
npx cap sync ios
cd ios/App
rm -rf build
xcodebuild -project App.xcodeproj -scheme App -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build | tail -5
rm -rf Payload && mkdir Payload
cp -R build/Build/Products/Release-iphoneos/App.app Payload/
mkdir -p ../../dist
rm -f ../../dist/PDFapp.ipa
zip -qry ../../dist/PDFapp.ipa Payload
rm -rf Payload
echo "Built dist/PDFapp.ipa. Copy it to the iPad (AirDrop, or iCloud Drive) and open it in AltStore."
