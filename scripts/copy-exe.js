// After building, copy the app folder (dist/win-unpacked) out of the repo.
// Default target: C:/program files (by claude)/PDFacil. Override with the PDFACIL_OUT environment variable.
// Close PDFacil before running this, otherwise Windows keeps the old files locked.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'dist', 'win-unpacked');
const outDir = process.env.PDFACIL_OUT || 'C:/program files (by claude)/PDFacil';
try {
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(src, outDir, { recursive: true, force: true });
  console.log(`Copied PDFacil to ${outDir} (run PDFacil.exe there).`);
} catch (e) {
  console.log(`Could not copy to ${outDir} (${e.message}). The app is in dist/win-unpacked.`);
}
