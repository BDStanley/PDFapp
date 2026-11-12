// After `npm run dist`, optionally copy the built app (dist/win-unpacked) to another folder.
// Set the PDFAPP_OUT environment variable to that folder; without it, nothing is copied.
// Close PDFapp before running this, otherwise Windows keeps the old files locked.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'dist', 'win-unpacked');
const outDir = process.env.PDFAPP_OUT;
if (!outDir) {
  console.log('Built the app in dist/win-unpacked. (Set PDFAPP_OUT to also copy it elsewhere.)');
  process.exit(0);
}
try {
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(src, outDir, { recursive: true, force: true });
  console.log(`Copied PDFapp to ${outDir} (run PDFapp.exe there).`);
} catch (e) {
  console.log(`Could not copy to ${outDir} (${e.message}). The app is in dist/win-unpacked.`);
}
