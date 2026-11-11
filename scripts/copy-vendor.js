// Copies pdf.js and pdf-lib from node_modules into src/vendor (not tracked by git).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const dest = path.join(root, 'src', 'vendor');
fs.mkdirSync(dest, { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(nm('pdfjs-dist', 'build', f), path.join(dest, f));
fs.copyFileSync(nm('pdfjs-dist', 'web', 'pdf_viewer.css'), path.join(dest, 'pdf_viewer.css'));
fs.copyFileSync(nm('pdf-lib', 'dist', 'pdf-lib.min.js'), path.join(dest, 'pdf-lib.min.js'));
for (const d of ['cmaps', 'standard_fonts']) fs.cpSync(nm('pdfjs-dist', d), path.join(dest, d), { recursive: true });
console.log('vendor files copied to src/vendor');
