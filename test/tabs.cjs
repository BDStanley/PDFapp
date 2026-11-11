const { _electron: electron } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
(async () => {
  const t0 = Date.now();
  const app = await electron.launch({ executablePath: require(path.join(root, 'node_modules', 'electron')), args: ['--no-sandbox', root, path.join(out, 'work.pdf')] });
  const win = await app.firstWindow();
  const errors = [];
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  win.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await win.waitForFunction(() => document.querySelector('.page canvas.pc'), null, { timeout: 20000 });
  console.log('launch to first page ms:', Date.now() - t0);
  const H = (fn, arg) => win.evaluate(fn, arg);
  // highlight in tab 1 via Comment > Highlight
  await win.click('.tab[data-tab=comment]');
  await win.click('[data-tool=highlight]');
  const spans = await win.$$('.page[data-idx="0"] .textLayer span');
  const a = await spans[1].boundingBox(), b = await spans[2].boundingBox();
  await win.mouse.move(a.x + 2, a.y + a.height / 2); await win.mouse.down();
  await win.mouse.move(b.x + b.width - 2, b.y + b.height / 2, { steps: 6 }); await win.mouse.up();
  await win.click('[data-tool=select]');
  // open second file
  await H((p) => window.__pdfacil.openPath(p), path.join(out, 'real.pdf'));
  await win.waitForTimeout(800);
  console.log('tabs:', await H(() => [...document.querySelectorAll('.doctab')].map((t) => t.className + ':' + t.textContent.replace('✕', '').trim())));
  await H(() => window.__pdfacil.S.pe[3].el.scrollIntoView());
  await win.waitForTimeout(300);
  await win.screenshot({ path: path.join(out, '11-tabs.png') });
  // switch back by clicking first tab
  await win.click('.doctab[data-idx="0"] .tname');
  await win.waitForTimeout(500);
  console.log('after switch:', await H(() => ({ name: window.__pdfacil.S.name, annots: window.__pdfacil.S.model.pages[0].annots.length, pages: document.querySelectorAll('.page').length, thumbs: document.querySelectorAll('.thumb').length, canv: document.querySelectorAll('.page canvas.pc').length, scrollTop: viewer.scrollTop })));
  await win.screenshot({ path: path.join(out, '12-tab-back.png') });
  // ctrl+tab to second, check its scroll position restored
  await win.click('#viewer', { position: { x: 5, y: 5 } });
  await win.keyboard.press('Control+Tab');
  await win.waitForTimeout(300);
  console.log('ctrl+tab ->', await H(() => ({ name: window.__pdfacil.S.name, cur: window.__pdfacil.S.current, pages: document.querySelectorAll('.page').length })));
  // re-open same file: no duplicate tab
  await H((p) => window.__pdfacil.openPath(p), path.join(out, 'work.pdf'));
  console.log('tab count after reopen:', await H(() => document.querySelectorAll('.doctab').length), 'active:', await H(() => window.__pdfacil.S.name));
  // close the clean tab (real.pdf) with middle click
  await win.click('.doctab[data-idx="1"]', { button: 'middle' });
  await win.waitForTimeout(300);
  console.log('after close:', await H(() => ({ tabs: document.querySelectorAll('.doctab').length, name: window.__pdfacil.S.name, dirtyClass: document.querySelector('.doctab').className })));
  const title = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle());
  console.log('title:', title);
  console.log('ERRORS:', errors.join('\n'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
