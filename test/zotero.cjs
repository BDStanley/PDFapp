// Zotero: connect, browse, open (download and local storage), two-way annotation sync, saving.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createMock } = require('./zotero-mock.cjs');

const root = path.join(__dirname, '..');
const sample = fs.readFileSync(path.join(__dirname, 'sample.pdf'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfacil-zotero-'));
const userData = path.join(tmp, 'userdata');
const zdata = path.join(tmp, 'Zotero');
fs.mkdirSync(zdata, { recursive: true });

const ok = (cond, msg) => {
  if (!cond) throw new Error('FAILED: ' + msg);
  console.log('ok -', msg);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, msg, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return;
    await wait(150);
  }
  throw new Error('FAILED (timed out): ' + msg);
}

(async () => {
  const mock = createMock(sample);
  await new Promise((r) => mock.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${mock.server.address().port}`;

  const app = await electron.launch({
    executablePath: require(path.join(root, 'node_modules', 'electron')),
    args: ['--no-sandbox', root],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1', ZOTERO_API_BASE: base, PDFACIL_USER_DATA: userData },
  });
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  win.on('dialog', (d) => d.accept());
  // Answer the app's own confirm boxes with the first button, and record error boxes.
  await app.evaluate(({ ipcMain }) => {
    globalThis.__errors = [];
    ipcMain.removeHandler('confirm');
    ipcMain.handle('confirm', () => 0);
    ipcMain.removeHandler('error');
    ipcMain.handle('error', (_e, m) => globalThis.__errors.push(m));
  });
  await win.waitForSelector('#welcome:not([hidden])');

  // 1. Connect: the Zotero button with no key opens the settings.
  await win.click('.panel.active [data-cmd=zotero]');
  await win.waitForSelector('#zoteroSetDlg:not([hidden])');
  await win.fill('#zsKey', 'WRONGKEY00000000000000000');
  await win.fill('#zsData', zdata);
  await win.click('#zoteroSetDlg [data-cmd=zoteroSave]');
  await until(async () => /did not accept/.test(await win.textContent('#zsMsg')), 'a bad key is refused');
  await win.fill('#zsKey', mock.KEY);
  await win.click('#zoteroSetDlg [data-cmd=zoteroSave]');
  await win.waitForSelector('#zoteroDlg:not([hidden])');
  ok(true, 'connected; the library browser opened');
  const stored = fs.readFileSync(path.join(userData, 'zotero.json'), 'utf8');
  const mode = fs.statSync(path.join(userData, 'zotero.json')).mode & 0o777;
  if (stored.includes('keyPlain')) ok(mode === 0o600, 'no keychain on this machine: the key file is readable by this user only');
  else ok(!stored.includes(mock.KEY), 'the key is stored encrypted');

  // 2. Browse: collection, search, select the item, open its PDF (not in local storage: downloaded).
  await win.waitForSelector('#zColls li[data-key=COLL0001]');
  await win.click('#zColls li[data-key=COLL0001]');
  await win.waitForSelector('#zItems li[data-key=COLLITEM]');
  await win.fill('#zSearch', 'polar');
  await wait(600);
  ok((await win.$$('#zItems li[data-key]')).length === 1, 'search finds the item');
  await win.click('#zItems li[data-key=COLLITEM]');
  await win.waitForSelector('#zItems [data-att=ATTACH01]');
  await win.screenshot({ path: path.join(__dirname, 'out', 'zotero-browser.png') });
  await win.click('#zOpen');
  await until(() => win.evaluate(() => !!window.__pdfacil.S.zotero && window.__pdfacil.S.zotero.lastPull > 0), 'PDF opened and linked');
  const st = await win.evaluate(() => ({ local: window.__pdfacil.S.zotero.local, path: window.__pdfacil.S.path, hidden: window.__pdfacil.S.zotero.hidden }));
  ok(st.local === false && st.path.includes('zotero-cache'), 'a PDF not in local storage is downloaded to the cache');
  ok(st.hidden === 1, 'an ink annotation is kept but not shown');

  // 3. The Zotero highlight is shown.
  const remote = await win.evaluate(() => window.__pdfacil.S.model.pages[0].annots.find((a) => a.z && a.contents === 'Made in Zotero'));
  ok(remote && remote.type === 'highlight' && remote.text === 'Remote highlight text', 'the Zotero highlight appears, with its text and comment');
  ok((await win.textContent('#zoteroState')).includes('up to date'), 'status shows up to date');

  // 4. A new highlight is sent to Zotero.
  await win.click('.tab[data-tab=comment]');
  await win.click('.panel.active [data-tool=highlight]');
  await win.waitForSelector('.page[data-idx="0"] .textLayer span');
  const spans = await win.$$('.page[data-idx="0"] .textLayer span');
  const b1 = await spans[1].boundingBox();
  const b2 = await spans[3].boundingBox();
  await win.mouse.move(b1.x + 2, b1.y + b1.height / 2);
  await win.mouse.down();
  await win.mouse.move(b2.x + b2.width * 0.6, b2.y + b2.height / 2, { steps: 8 });
  await win.mouse.up();
  await until(() => mock.annotations().some((it) => it.key.startsWith('NEW') && it.data.annotationType === 'highlight'), 'new highlight reaches Zotero');
  const created = mock.annotations().find((it) => it.key.startsWith('NEW'));
  const pos = JSON.parse(created.data.annotationPosition);
  ok(created.data.parentItem === 'ATTACH01' && pos.pageIndex === 0 && pos.rects.length > 0, 'it is a child of the PDF, on page 1, with rectangles');
  ok(created.data.annotationText.length > 5 && /^\d{5}\|\d{6}\|\d{5}$/.test(created.data.annotationSortIndex), 'it has its text and a valid sort index');
  ok(created.data.annotationColor === '#ffd400', 'PDFacil yellow is written as Zotero yellow');
  await until(() => win.evaluate(() => !window.__pdfacil.S.zotero.pending), 'nothing left to send');
  ok(!(await win.evaluate(() => document.querySelector('.doctab.active').classList.contains('dirty'))), 'the tab is not marked unsaved');

  // 5. A comment and a text box.
  await win.click('.panel.active [data-tool=note]');
  const pg = await (await win.$('.page[data-idx="0"]')).boundingBox();
  await win.mouse.click(pg.x + 80, pg.y + 420);
  await wait(100);
  await win.keyboard.type('Check this against CBOS.');
  await win.keyboard.press('Escape');
  await win.click('.panel.active [data-tool=text]');
  await win.mouse.click(pg.x + 300, pg.y + 640);
  await win.keyboard.type('Typed note');
  await win.keyboard.press('Escape');
  await win.click('.panel.active [data-tool=select]');
  await until(() => mock.annotations().some((it) => it.data.annotationType === 'note' && it.data.annotationComment === 'Check this against CBOS.'), 'comment reaches Zotero');
  await until(() => mock.annotations().some((it) => it.data.annotationType === 'text' && it.data.annotationComment === 'Typed note'), 'text box reaches Zotero');

  // 6. Editing the Zotero highlight's comment changes it in Zotero.
  await win.evaluate(() => {
    const { S } = window.__pdfacil;
    S.model.pages[0].annots.find((a) => a.contents === 'Made in Zotero').contents = 'Edited in PDFacil';
    S.zotero.touch();
  });
  await until(() => mock.items.get('REMOTE01').data.annotationComment === 'Edited in PDFacil', 'an edit reaches Zotero');
  ok(mock.items.get('REMOTE01').data.annotationColor === '#5fb236', 'its Zotero colour is kept');

  // 7. Deleting the comment deletes it in Zotero; undo brings it back.
  const noteKey = mock.annotations().find((it) => it.data.annotationType === 'note').key;
  await win.evaluate(() => {
    const { S } = window.__pdfacil;
    const a = S.model.pages[0].annots.find((x) => x.type === 'note');
    window.__pdfacil.S.sel = { page: 0, id: a.id };
  });
  await win.click('.panel.active [data-cmd=deleteAnnot]');
  await until(() => !mock.items.has(noteKey), 'a deletion reaches Zotero');
  await win.click('#viewer', { position: { x: 5, y: 5 } });
  await win.keyboard.press('Control+z');
  await until(() => mock.annotations().some((it) => it.data.annotationType === 'note'), 'undo sends it back');

  // 8. Changes made in Zotero come in.
  mock.remoteEdit('REMOTE01', { annotationComment: 'Changed on the iPad' });
  const before = mock.annotations().length;
  mock.items.set('IPADNEW1', {
    key: 'IPADNEW1', version: 999,
    data: { key: 'IPADNEW1', itemType: 'annotation', parentItem: 'ATTACH01', annotationType: 'note', annotationComment: 'From the iPad', annotationColor: '#ffd400', annotationPageLabel: '2', annotationSortIndex: '00001|000000|00100', annotationPosition: JSON.stringify({ pageIndex: 1, rects: [[100, 500, 122, 522]] }) },
  });
  await win.evaluate(() => window.__pdfacil.S.zotero.pull());
  const pulled = await win.evaluate(() => ({
    edited: window.__pdfacil.S.model.pages[0].annots.some((a) => a.contents === 'Changed on the iPad'),
    added: window.__pdfacil.S.model.pages[1].annots.some((a) => a.contents === 'From the iPad'),
  }));
  ok(pulled.edited && pulled.added, 'remote edits and new remote annotations appear');
  ok(mock.annotations().length === before + 1, 'pulling does not send anything back');

  // 9. Deleting pages is refused for a Zotero PDF.
  await win.evaluate(() => window.__pdfacil.deletePages([2]));
  ok((await app.evaluate(() => globalThis.__errors.pop() || '')).includes('cannot be deleted'), 'page deletion is refused');

  // 10. A PDF in the local Zotero storage folder is linked when opened directly.
  const storeDir = path.join(zdata, 'storage', 'ATTACH01');
  fs.mkdirSync(storeDir, { recursive: true });
  const storePdf = path.join(storeDir, 'paper.pdf');
  fs.writeFileSync(storePdf, sample);
  await win.evaluate(() => window.__pdfacil.closeTab());
  await win.evaluate((p) => window.__pdfacil.openPath(p), storePdf);
  await until(() => win.evaluate(() => window.__pdfacil.S.zotero?.attKey === 'ATTACH01' && window.__pdfacil.S.zotero.lastPull > 0), 'a storage PDF is linked automatically');
  ok(await win.evaluate(() => window.__pdfacil.S.zotero.local === true), 'it is marked as local');
  const n = await win.evaluate(() => window.__pdfacil.S.model.pages.flatMap((p) => p.annots).filter((a) => a.z).length);
  ok(n === mock.annotations().filter((it) => it.data.annotationType !== 'ink').length, 'every Zotero annotation is loaded, once each');

  // 11. Rotating a page and saving writes the file, without copying Zotero annotations into it.
  await win.evaluate(() => window.__pdfacil.rotatePages(90, [0]));
  await win.evaluate(() => window.__pdfacil.save(false));
  const { PDFDocument } = require(path.join(root, 'node_modules', 'pdf-lib'));
  const saved = await PDFDocument.load(fs.readFileSync(storePdf));
  ok(saved.getPage(0).getRotation().angle === 90, 'the rotation is saved into the storage file');
  const annots = saved.getPages().reduce((k, p) => k + (p.node.Annots()?.size() || 0), 0);
  ok(annots === 0, 'no Zotero annotation is written into the file');

  console.log('requests:', mock.log.length);
  console.log('ERRORS:', errors.join('\n'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
  await app.close().catch(() => {});
  mock.server.close();
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
