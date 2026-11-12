const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
// Sample files for the recent list, created fresh in a temp folder.
function makeFixtures() {
  const os = require('os');
  const rootDir = path.join(os.tmpdir(), 'pdfacil-recent-test');
  const deep = path.join(rootDir, 'Documents', 'Research', 'Literature review - 2026', 'papers', 'cited by chapter 3');
  const dl = path.join(rootDir, 'Downloads');
  fs.mkdirSync(deep, { recursive: true });
  fs.mkdirSync(dl, { recursive: true });
  const sample = path.join(__dirname, 'sample.pdf');
  const longName = path.join(dl, 'Smith et al 2025 - A very long title about measuring behavior with open ended survey responses.pdf');
  const shortName = path.join(dl, 'Preregistration #1234.pdf');
  fs.copyFileSync(sample, longName);
  fs.copyFileSync(sample, shortName);
  for (let i = 1; i <= 40; i++) fs.copyFileSync(sample, path.join(deep, `Paper-${String(i).padStart(3, '0')}-Author-${1970 + i}.pdf`));
  return { deep, longName, shortName };
}

(async () => {
  const app = await electron.launch({ executablePath: require(path.join(root, 'node_modules', 'electron')), args: ['--no-sandbox', root] });
  const ud = await app.evaluate(({ app }) => app.getPath('userData'));
  const fx = makeFixtures();
  const base = fx.deep;
  const now = Date.now();
  const files = [{ path: fx.longName, time: now }]
    .concat(fs.readdirSync(base).slice(0, 12).map((f, k) => ({ path: path.join(base, f), time: now - (k + 1) * 86400000 })));
  fs.writeFileSync(path.join(ud, 'recent.json'), JSON.stringify(files));
  const win = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); });
  await win.reload();
  await win.waitForSelector('#recentTable tbody tr');
  for (const w of [1500, 1100, 900, 760, 640, 520]) {
    await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, 700), w);
    await win.waitForTimeout(300);
    const info = await win.evaluate(() => {
      const ths = [...document.querySelectorAll('#recentTable th')];
      return { box: document.querySelector('#recentBox').clientWidth, cols: ths.map((t) => (t.offsetParent ? `${t.textContent}:${t.offsetWidth}` : `${t.textContent}:hidden`)).join(' | ') };
    });
    console.log(w, JSON.stringify(info));
    if (w === 760 || w === 520) await win.screenshot({ path: path.join(out, `22-narrow-${w}.png`) });
  }
  fs.writeFileSync(path.join(ud, 'recent.json'), '[]');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
