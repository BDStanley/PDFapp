const { _electron: electron } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
(async () => {
  const app = await electron.launch({ executablePath: require(path.join(root, 'node_modules', 'electron')), args: ['--no-sandbox', root, path.join(out, 'outlined.pdf')] });
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push(e.message));
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await win.waitForFunction(() => document.querySelector('.page canvas.pc'), null, { timeout: 20000 });
  await win.click('.panel.active [data-cmd=toggleOutline]');
  await win.waitForSelector('.ol-row');
  const rows = () => win.$$eval('.ol-row', (r) => r.map((x) => (x.offsetParent ? '' : '(hidden)') + x.textContent + (x.classList.contains('current') ? ' <==' : '')));
  console.log('bookmarks:', JSON.stringify(await rows()));
  await win.click('.ol-row:has-text("Chapter 4 landscape")');
  await win.waitForTimeout(300);
  console.log('after click page:', await win.evaluate(() => window.__pdfacil.S.current + 1), JSON.stringify((await rows()).filter((r) => r.includes('<=='))));
  await win.screenshot({ path: path.join(out, '19-outline.png') });
  // scroll to page 6, highlight follows
  await win.evaluate(() => window.__pdfacil.S.pe[5].el.scrollIntoView());
  await win.waitForTimeout(400);
  console.log('after scroll:', JSON.stringify((await rows()).filter((r) => r.includes('<=='))));
  // collapse Part I
  await win.click('.ol-row:has-text("Part I") .ol-tw');
  console.log('collapsed:', JSON.stringify(await rows()));
  // second tab with no outline: auto headings
  await win.evaluate((p) => window.__pdfacil.openPath(p), path.join(out, 'real.pdf'));
  await win.waitForSelector('#outlineNote:not(:empty)', { timeout: 20000 });
  await win.waitForTimeout(300);
  const auto = await rows();
  console.log('auto headings:', auto.length, JSON.stringify(auto.slice(0, 14)));
  await win.screenshot({ path: path.join(out, '20-outline-auto.png') });
  // switch back to first tab, outline restored
  await win.click('.doctab[data-idx="0"] .tname');
  await win.waitForTimeout(300);
  console.log('back on tab 1:', (await rows()).length);
  // hide via ribbon toggle
  await win.click('.panel.active [data-cmd=toggleOutline]');
  console.log('hidden:', await win.$eval('#outlinePanel', (p) => p.classList.contains('hidden')));
  console.log('ERRORS:', errors.join('\n'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
