// After building, copy the portable exe out of the repo.
// Default target: C:/dropbox/Programs. Override with the PDFACIL_OUT environment variable.
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const exe = path.join(__dirname, '..', 'dist', `PDFacil-${pkg.version}-portable.exe`);
const outDir = process.env.PDFACIL_OUT || 'C:/dropbox/Programs';
if (!fs.existsSync(outDir)) {
  console.log(`Output folder ${outDir} not found; the exe stays in dist/.`);
  process.exit(0);
}
fs.copyFileSync(exe, path.join(outDir, path.basename(exe)));
console.log(`Copied ${path.basename(exe)} to ${outDir}`);
