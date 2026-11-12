const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
(async () => {
  const app = await electron.launch({ executablePath: require(path.join(root, 'node_modules', 'electron')), args: ['--no-sandbox', root] });
  const ud = await app.evaluate(({ app }) => app.getPath('userData'));
  const base = '/tmp/rt/dropbox/research/Confounds Protocols - JCR/papers/JCR citing NW';
  const now = Date.now();
  const files = [{ path: '/tmp/rt/Downloads/8326 - Haaland et al 2025 understanding economic behavior using open ended survey data and large language models.pdf', time: now }]
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
