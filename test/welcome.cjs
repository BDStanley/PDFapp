const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
(async () => {
  const app = await electron.launch({ executablePath: require(path.join(root, 'node_modules', 'electron')), args: ['--no-sandbox', root] });
  const ud = await app.evaluate(({ app }) => app.getPath('userData'));
  const files = [];
  const base = '/tmp/rt/dropbox/research/Confounds Protocols - JCR/papers/JCR citing NW';
  const now = Date.now();
  files.push({ path: '/tmp/rt/Downloads/8326 - Haaland et al 2025 understanding economic behavior using open ended survey data and large language models.pdf', time: now - 20 * 60000 });
  files.push({ path: '/tmp/rt/Downloads/AsPredicted #157290.pdf', time: now - 26 * 3600000 });
  fs.readdirSync(base).forEach((f, k) => files.push({ path: path.join(base, f), time: now - (k + 2) * 86400000 * 1.7 }));
  files.splice(5, 0, '/tmp/rt/Downloads/AsPredicted #157290.pdf'); // old-format entry (string, duplicate)
  files.push({ path: '/tmp/does/not/exist.pdf', time: now });
  fs.mkdirSync(ud, { recursive: true });
  fs.writeFileSync(path.join(ud, 'recent.json'), JSON.stringify(files));
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push(e.message));
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await win.reload();
  await win.waitForSelector('#recentTable tbody tr');
  console.log('rows:', await win.$$eval('#recentTable tbody tr', (r) => r.length), 'count label:', await win.textContent('#recentCount'));
  console.log('first rows:', JSON.stringify(await win.$$eval('#recentTable tbody tr', (r) => r.slice(0, 3).map((x) => [...x.children].map((c) => c.textContent.replace(/‎/g, ''))))));
  await win.screenshot({ path: path.join(out, '21-welcome.png') });
  // right-click remove
  await win.click('#recentTable tbody tr:nth-child(2)', { button: 'right' });
  await win.click('#ctxMenu .mi:has-text("Remove from list")');
  await win.waitForTimeout(300);
  console.log('rows after remove:', await win.$$eval('#recentTable tbody tr', (r) => r.length));
  // open from table, then close tab -> welcome again and it is first
  await win.click('#recentTable tbody tr:nth-child(4)');
  await win.waitForFunction(() => document.querySelector('.page canvas.pc'), null, { timeout: 20000 });
  const opened = await win.evaluate(() => window.__pdfacil.S.name);
  await win.keyboard.press('Control+w');
  await win.waitForTimeout(400);
  console.log('opened', opened, '-> now first row:', await win.$eval('#recentTable tbody tr td.file', (td) => td.textContent), await win.$eval('#recentTable tbody tr td.time', (td) => td.textContent));
  // recent dropdown limited to 15
  await win.click('.tab[data-tab=file]');
  await win.click('.panel.active [data-cmd=recentMenu]');
  console.log('dropdown items:', await win.$$eval('#recentMenu .mi', (r) => r.length));
  console.log('ERRORS:', errors.join('\n'));
  fs.writeFileSync(path.join(ud, 'recent.json'), '[]');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
