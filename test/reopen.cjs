const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
(async () => {
  const app = await electron.launch({
    executablePath: require(path.join(root, 'node_modules', 'electron')),
    args: ['--no-sandbox', root, path.join(out, 'work.pdf')],
  });
  // Replace the print handler so no system dialog opens; save first page image instead.
  await app.evaluate(({ ipcMain }, outDir) => {
    ipcMain.removeHandler('print-pages');
    ipcMain.handle('print-pages', (_e, pages) => {
      process.mainModule.require('fs').writeFileSync(outDir + '/print-p1.png', Buffer.from(pages[0].png));
      return { ok: true, n: pages.length };
    });
  }, out);
  const win = await app.firstWindow();
  const errors = [];
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  win.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await win.waitForFunction(() => window.__pdfacil?.S.pdf && document.querySelector('.page canvas.pc'), null, { timeout: 20000 });
  await win.waitForTimeout(800);
  const info = await win.evaluate(() => ({
    annots: window.__pdfacil.S.model.pages.map((p) => p.annots.map((a) => a.type + (a.text ? ':' + a.text.slice(0, 12) : a.contents ? ':' + a.contents : ''))),
    overflowX: viewer.scrollWidth - viewer.clientWidth,
    title: document.title,
  }));
  console.log(JSON.stringify(info));
  const wt = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle());
  console.log('window title:', wt);
  await win.screenshot({ path: path.join(out, '06-reopen.png') });
  // Hover over a note shows tooltip title; click to open popup
  const note = await win.$('.ann-note');
  await note.click();
  await win.waitForTimeout(200);
  await win.screenshot({ path: path.join(out, '07-note.png') });
  await win.keyboard.press('Escape');
  // select the text box, delete it via Delete key, check dirty
  const tb = await win.$('.page[data-idx="0"] .ann-text .tb');
  await tb.click();
  await win.keyboard.press('Delete');
  console.log('after delete:', await win.evaluate(() => window.__pdfacil.S.model.pages[0].annots.length));
  console.log('window title:', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()));
  // print
  await win.keyboard.press('Control+p');
  await win.waitForFunction(() => document.querySelector('#busy').hidden, null, { timeout: 30000 });
  await win.waitForTimeout(500);
  console.log('print file exists:', fs.existsSync(path.join(out, 'print-p1.png')));
  console.log('ERRORS:', errors.join('\n'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
