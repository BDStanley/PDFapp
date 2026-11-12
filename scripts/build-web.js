// Builds www/, the web part of the iPad app, from src/ (the same code as the desktop app).
//   - copies src/ and the icon;
//   - renames PDF.js's .mjs files to .js, because iOS serves files by extension and may not treat .mjs as JavaScript;
//   - loads ios-web/ios-api.js (the iPad's version of the desktop preload API) and ios-web/ios.css before the app.
// Run by `npm run ios:sync`; www/ is gitignored.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const out = path.join(root, 'www');

if (!fs.existsSync(path.join(src, 'vendor', 'pdf.min.mjs'))) {
  console.error('src/vendor is missing: run npm install first.');
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
fs.mkdirSync(path.join(out, 'build'), { recursive: true });
fs.copyFileSync(path.join(root, 'build', 'icon.png'), path.join(out, 'build', 'icon.png'));
for (const f of ['ios-api.js', 'ios.css']) fs.copyFileSync(path.join(root, 'ios-web', f), path.join(out, f));

for (const f of ['pdf.min', 'pdf.worker.min']) fs.renameSync(path.join(out, 'vendor', `${f}.mjs`), path.join(out, 'vendor', `${f}.js`));

const edit = (file, pairs) => {
  const p = path.join(out, file);
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${file}: "${a}" not found; update scripts/build-web.js`);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(p, s);
};
edit('app.js', [
  ["'./vendor/pdf.min.mjs'", "'./vendor/pdf.min.js'"],
  ["'./vendor/pdf.worker.min.mjs'", "'./vendor/pdf.worker.min.js'"],
]);
edit('index.html', [
  ['../build/icon.png', 'build/icon.png'],
  ['<meta charset="utf-8" />', '<meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'],
  ['<link rel="stylesheet" href="styles.css" />', '<link rel="stylesheet" href="styles.css" />\n  <link rel="stylesheet" href="ios.css" />'],
  ['<script type="module" src="app.js"></script>', '<script src="ios-api.js"></script>\n  <script type="module" src="app.js"></script>'],
]);
console.log(`www/ built from src/ (${fs.readdirSync(out).length} entries).`);
