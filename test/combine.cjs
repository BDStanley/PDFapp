// Extract selected pages and merge PDFs, with the file dialogs stubbed.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
const a = path.join(out, 'a.pdf');
const b = path.join(out, 'b.pdf');
fs.copyFileSync(path.join(__dirname, 'sample.pdf'), a);
fs.copyFileSync(path.join(__dirname, 'outlined.pdf'), b);
const extracted = path.join(out, 'extracted.pdf');
const merged = path.join(out, 'merged.pdf');
for (const f of [extracted, merged]) fs.rmSync(f, { force: true });

(async () => {
  const app = await electron.launch({
    executablePath: require(path.join(root, 'node_modules', 'electron')),
    args: ['--no-sandbox', root, a],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  });
  // Stub the open and save dialogs: each save returns the next path queued.
  await app.evaluate(({ ipcMain }, [open, saves]) => {
    globalThis.__saves = saves;
    ipcMain.removeHandler('open-dialog');
    ipcMain.handle('open-dialog', () => open);
    ipcMain.removeHandler('save-dialog');
    ipcMain.handle('save-dialog', (_e, suggested) => {
      globalThis.__suggested = (globalThis.__suggested || []).concat(suggested);
      return globalThis.__saves.shift();
    });
  }, [[b], [extracted, merged]]);
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await win.waitForFunction(() => window.__pdfacil?.S.pdf && document.querySelector('.thumb'), null, { timeout: 20000 });
  const n0 = await win.evaluate(() => window.__pdfacil.S.model.pages.length);
  const nb = await win.evaluate(async () => (await window.__pdfacil.S.pdf.numPages));
  console.log('pages in a.pdf:', n0);

  // Select pages 2 and 4 with Ctrl+click, rotate page 2, then extract.
  await win.click('.thumb[data-idx="1"]');
  await win.click('.thumb[data-idx="1"]', { button: 'right' });
  await win.click('.menu >> text=Rotate page right');
  await win.click('.thumb[data-idx="1"]');
  await win.click('.thumb[data-idx="3"]', { modifiers: ['Control'] });
  await win.click('.tab[data-tab=pages]');
  await win.click('.panel.active [data-cmd=extractPages]');
  await win.waitForFunction(() => window.__pdfacil.S.name === 'extracted.pdf', null, { timeout: 15000 });
  const ex = await win.evaluate(() => ({
    n: window.__pdfacil.S.model.pages.length,
    rot: window.__pdfacil.S.pdfPages.map((p) => p.rotate),
  }));
  console.log('extracted:', JSON.stringify(ex));
  if (ex.n !== 2) throw new Error('expected 2 extracted pages');
  if (ex.rot[0] !== 90 || ex.rot[1] !== 0) throw new Error('rotation of page 2 not carried over');

  // Back to a.pdf, merge it with b.pdf.
  await win.click('.doctab >> nth=0');
  await win.waitForFunction(() => window.__pdfacil.S.name === 'a.pdf');
  await win.click('.panel.active [data-cmd=mergePdfs]');
  await win.waitForSelector('#mergeDlg:not([hidden])');
  await win.click('#mergeDlg [data-cmd=mergeAdd]');
  await win.waitForFunction(() => document.querySelectorAll('#mergeList li').length === 2);
  const names = await win.$$eval('#mergeList .mname', (els) => els.map((e) => e.textContent));
  console.log('merge list:', names);
  await win.screenshot({ path: path.join(out, 'merge-dialog.png') });
  // Move b.pdf to the top, then merge.
  await win.click('#mergeList li:nth-child(2) [data-m=up]');
  const names2 = await win.$$eval('#mergeList .mname', (els) => els.map((e) => e.textContent));
  console.log('after move:', names2);
  await win.click('#mergeRun');
  await win.waitForFunction(() => window.__pdfacil.S.name === 'merged.pdf', null, { timeout: 15000 });
  const mn = await win.evaluate(() => window.__pdfacil.S.model.pages.length);
  const bPages = await (async () => {
    const { PDFDocument } = require(path.join(root, 'node_modules', 'pdf-lib'));
    return (await PDFDocument.load(fs.readFileSync(b))).getPageCount();
  })();
  console.log('merged pages:', mn, '=', bPages, '+', n0);
  if (mn !== bPages + n0) throw new Error('merged page count wrong');
  // a.pdf's rotation edit was unsaved; the merge includes it (page 2 of a.pdf).
  const rotMerged = await win.evaluate((k) => window.__pdfacil.S.pdfPages[k].rotate, bPages + 1);
  console.log('rotation of a.pdf page 2 inside merged:', rotMerged);
  if (rotMerged !== 90) throw new Error('unsaved edit not included in merge');
  console.log('suggested names:', await app.evaluate(() => globalThis.__suggested));
  console.log('ERRORS:', errors.join('\n'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
  await app.close().catch(() => {});
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
