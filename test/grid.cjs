// The page grid: open it from the View tab, pick pages every way, extract them, close it.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfapp-grid-'));
const pdf = path.join(tmp, 'Party systems in CEE.pdf');
fs.copyFileSync(path.join(__dirname, 'sample.pdf'), pdf);
const extracted = path.join(tmp, 'picked.pdf');
const ok = (c, m) => {
  if (!c) throw new Error('FAILED: ' + m);
  console.log('ok -', m);
};

(async () => {
  const app = await electron.launch({
    executablePath: require(path.join(root, 'node_modules', 'electron')),
    args: ['--no-sandbox', root, pdf],
    env: { ...process.env, PDFAPP_USER_DATA: path.join(tmp, 'ud') },
  });
  await app.evaluate(({ ipcMain }, p) => {
    ipcMain.removeHandler('save-dialog');
    ipcMain.handle('save-dialog', () => p);
  }, extracted);
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push(e.message));
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.unmaximize();
    w.setSize(1280, 820);
  });
  await win.waitForFunction(() => window.__pdfapp?.S.pdf && document.querySelector('.thumb'));
  const n = await win.evaluate(() => window.__pdfapp.S.model.pages.length);
  ok((await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())).endsWith('- PDFapp'), 'the window is titled PDFapp');

  await win.click('.tab[data-tab=view]');
  await win.click('.panel.active [data-cmd=toggleGrid]');
  await win.waitForSelector('#grid:not([hidden]) .gcell');
  ok((await win.$$('.gcell')).length === n, `the grid shows all ${n} pages`);
  await win.waitForFunction(() => document.querySelectorAll('.gcell canvas').length >= 3, null, { timeout: 15000 });
  ok(true, 'thumbnails are drawn');
  ok(await win.evaluate(() => document.querySelector('[data-cmd=toggleGrid]').classList.contains('active')), 'the button shows the grid is on');

  const sel = () => win.evaluate(() => [...window.__pdfapp.S.selPages].sort((a, b) => a - b));
  const cell = (i) => `.gcell[data-idx="${i}"] .gbox`;
  await win.click(cell(0));
  ok(JSON.stringify(await sel()) === '[0]', 'click selects one page');
  await win.click(cell(2), { modifiers: ['Control'] });
  ok(JSON.stringify(await sel()) === '[0,2]', 'Ctrl-click adds a page');
  await win.click(cell(4), { modifiers: ['Shift'] });
  ok(JSON.stringify(await sel()) === '[2,3,4]', 'Shift-click selects a range');
  await win.click(`.gcell[data-idx="0"] .gcheck`);
  ok(JSON.stringify(await sel()) === '[0,2,3,4]', 'the circle adds a page without a modifier key');
  await win.click(`.gcell[data-idx="3"] .gcheck`);
  ok(JSON.stringify(await sel()) === '[0,2,4]', 'and takes it away again');
  ok((await win.textContent('#gridInfo')).includes('3 of 6 selected'), 'the bar counts the selection');
  ok(await win.evaluate(() => document.querySelectorAll('.thumb.selected').length === 3), 'the side thumbnails show the same selection');
  await win.screenshot({ path: path.join(out, 'grid.png') });

  // Drag a box from the gap left of page 2 to the middle of page 3 (first row).
  const g = await (await win.$('#gridCells')).boundingBox();
  const c2 = await (await win.$('.gcell[data-idx="2"]')).boundingBox();
  await win.mouse.move(g.x + 6, g.y + 6);
  await win.mouse.down();
  await win.mouse.move(c2.x + c2.width / 2, c2.y + c2.height / 2, { steps: 8 });
  await win.screenshot({ path: path.join(out, 'grid-drag.png') });
  await win.mouse.up();
  ok(JSON.stringify(await sel()) === '[0,1,2]', 'dragging a box selects the pages it touches');

  await win.keyboard.press('Control+a');
  ok((await sel()).length === n, 'Ctrl+A selects every page');
  await win.click('[data-cmd=gridClear]');
  ok((await sel()).length === 0, 'Select none clears it');

  // Pick pages 2 and 5 and extract them from the bar.
  await win.click(cell(1));
  await win.click(cell(4), { modifiers: ['Control'] });
  await win.click('.gbar [data-cmd=extractPages]');
  await win.waitForFunction(() => window.__pdfapp.S.name === 'picked.pdf', null, { timeout: 15000 });
  ok((await win.evaluate(() => window.__pdfapp.S.model.pages.length)) === 2, 'Extract selected makes a PDF of those pages');
  ok(await win.evaluate(() => window.__pdfapp.isGridOpen()), 'the grid stays open on the new document');

  // Back to the first document; double-click opens a page in the reading view.
  await win.click('.doctab >> nth=0');
  await win.waitForSelector('.gcell[data-idx="3"]');
  await win.dblclick(cell(3));
  ok(!(await win.evaluate(() => window.__pdfapp.isGridOpen())) && (await win.evaluate(() => window.__pdfapp.S.current)) === 3, 'double-click opens that page');
  await win.keyboard.press('Control+Shift+G');
  ok(await win.evaluate(() => window.__pdfapp.isGridOpen()), 'Ctrl+Shift+G opens the grid');
  await win.keyboard.press('Escape');
  ok(!(await win.evaluate(() => window.__pdfapp.isGridOpen())), 'Escape closes it');

  await win.keyboard.press('F1');
  await win.waitForSelector('#aboutDlg:not([hidden])');
  const about = await win.textContent('#aboutDlg');
  ok(about.includes('PDFapp') && about.includes('Further developed by') && about.includes('Ben Stanley') && about.includes('Uri Simonsohn'), 'About names PDFapp and both authors');
  await win.screenshot({ path: path.join(out, 'about.png') });

  ok(errors.length === 0, 'no page errors ' + errors.join('; '));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
