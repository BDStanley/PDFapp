// Copy Notes and Save Notes: highlighted text, comments, text boxes, the text-from-position fallback.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
const pdf = path.join(out, 'notes.pdf');
fs.copyFileSync(path.join(__dirname, 'sample.pdf'), pdf);
const md = path.join(out, 'notes.md');
if (fs.existsSync(md)) fs.unlinkSync(md);

(async () => {
  const app = await electron.launch({
    executablePath: require(path.join(root, 'node_modules', 'electron')),
    args: ['--no-sandbox', root, pdf],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  });
  await app.evaluate(({ ipcMain }, mdPath) => {
    ipcMain.removeHandler('save-dialog');
    ipcMain.handle('save-dialog', (_e, suggested, kind) => {
      globalThis.__dlg = { suggested, kind };
      return kind === 'md' ? mdPath : null;
    });
  }, md);
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await win.waitForFunction(() => window.__pdfacil?.S.pdf && document.querySelector('.page[data-idx="0"] .textLayer span'), null, { timeout: 20000 });

  // Highlight across two lines of page 1 by dragging over text.
  await win.click('.tab[data-tab=comment]');
  await win.click('.panel.active [data-tool=highlight]');
  const spans = await win.$$('.page[data-idx="0"] .textLayer span');
  const b1 = await spans[2].boundingBox();
  const b2 = await spans[6].boundingBox();
  await win.mouse.move(b1.x + 1, b1.y + b1.height / 2);
  await win.mouse.down();
  await win.mouse.move(b2.x + b2.width - 1, b2.y + b2.height / 2, { steps: 10 });
  await win.mouse.up();
  await win.waitForTimeout(200);
  const selText = await win.evaluate(() => window.__pdfacil.S.model.pages[0].annots[0]?.text);
  console.log('stored text:', JSON.stringify(selText));
  if (!selText) throw new Error('highlight has no stored text');

  // The same highlight, worked out from position only.
  const geoText = await win.evaluate(async () => {
    const { S } = window.__pdfacil;
    const a = S.model.pages[0].annots[0];
    const { textUnderQuads } = await import('./notes.js');
    return textUnderQuads(await S.pdfPages[0].getTextContent(), a.quads);
  });
  console.log('from position:', JSON.stringify(geoText));
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  if (norm(geoText) !== norm(selText)) console.log('NOTE: position-based text differs from the selection');

  // A comment on the highlight, a sticky note and a text box.
  await win.evaluate(() => (window.__pdfacil.S.model.pages[0].annots[0].contents = 'Key claim for chapter 2.'));
  const pg = await (await win.$('.page[data-idx="0"]')).boundingBox();
  await win.click('.panel.active [data-tool=note]');
  await win.mouse.click(pg.x + 80, pg.y + 400);
  await win.waitForTimeout(100);
  await win.keyboard.type('Check this number again.');
  await win.keyboard.press('Escape');
  await win.click('.panel.active [data-tool=text]');
  await win.mouse.click(pg.x + 300, pg.y + 600);
  await win.keyboard.type('Typed on the page.');
  await win.keyboard.press('Escape');
  await win.click('.panel.active [data-tool=select]');

  // Copy Notes, then Save Notes.
  await win.click('.panel.active [data-cmd=copyNotes]');
  await win.waitForTimeout(300);
  const clip = await app.evaluate(({ clipboard }) => clipboard.readText());
  console.log('--- clipboard ---\n' + clip + '-----------------');
  for (const want of ['## Page 1', '> ', 'Key claim for chapter 2.', '**Comment:** Check this number again.', '**Text on the page:** Typed on the page.'])
    if (!clip.includes(want)) throw new Error('missing from notes: ' + want);
  if (!clip.includes(norm(selText).slice(0, 20))) throw new Error('highlighted text missing');
  await win.click('.panel.active [data-cmd=saveNotes]');
  await win.waitForTimeout(500);
  const dlg = await app.evaluate(() => globalThis.__dlg);
  console.log('save dialog:', dlg);
  if (fs.readFileSync(md, 'utf8') !== clip) throw new Error('saved file differs from clipboard');
  const recent = await win.evaluate(() => window.api.getRecent());
  if (recent.some((r) => /\.md$/.test(r.path))) throw new Error('notes file added to Recent');

  // The stored text survives saving and reopening the PDF.
  await win.evaluate(() => window.__pdfacil.save(false));
  await win.evaluate(() => window.__pdfacil.closeTab());
  await win.evaluate((p) => window.__pdfacil.openPath(p), pdf);
  await win.waitForFunction(() => window.__pdfacil.S.pdf);
  const reopened = await win.evaluate(() => window.__pdfacil.S.model.pages[0].annots.find((a) => a.type === 'highlight')?.text);
  console.log('text after reopening:', JSON.stringify(reopened));
  if (reopened !== selText) throw new Error('stored text lost on save');

  console.log('ERRORS:', errors.join('\n'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
  await app.close().catch(() => {});
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
