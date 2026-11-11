// Smoke test: launches PDFacil with the sample PDF and exercises the main features.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
const sample = path.join(out, 'work.pdf');
fs.copyFileSync(path.join(__dirname, 'sample.pdf'), sample);

(async () => {
  const app = await electron.launch({
    executablePath: require(path.join(root, 'node_modules', 'electron')),
    args: ['--no-sandbox', root, sample],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  });
  const win = await app.firstWindow();
  const errors = [];
  win.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  win.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await win.setViewportSize({ width: 1400, height: 900 }).catch(() => {});
  await win.waitForFunction(() => window.__pdfacil?.S.pdf && document.querySelector('.page canvas.pc'), null, { timeout: 20000 });
  await win.waitForTimeout(800);
  await win.screenshot({ path: path.join(out, '01-open.png') });

  // Comment tab, highlight by selecting text on page 1
  await win.click('.tab[data-tab=comment]');
  await win.click('[data-tool=highlight]');
  const spans = await win.$$('.page[data-idx="0"] .textLayer span');
  console.log('text spans on page 1:', spans.length);
  const b1 = await spans[1].boundingBox();
  const b2 = await spans[3].boundingBox();
  await win.mouse.move(b1.x + 2, b1.y + b1.height / 2);
  await win.mouse.down();
  await win.mouse.move(b2.x + b2.width * 0.6, b2.y + b2.height / 2, { steps: 8 });
  await win.mouse.up();
  await win.waitForTimeout(200);
  console.log('highlights after select:', await win.evaluate(() => window.__pdfacil.S.model.pages[0].annots.length));

  // Text box
  await win.click('[data-tool=text]');
  const pg = await (await win.$('.page[data-idx="0"]')).boundingBox();
  await win.mouse.click(pg.x + 300, pg.y + 140);
  await win.keyboard.type('Hello from PDFacil! This is a longer note that should wrap onto a second line nicely.');
  await win.keyboard.press('Escape');
  // Sticky note
  await win.click('[data-tool=note]');
  await win.mouse.click(pg.x + 80, pg.y + 300);
  await win.waitForTimeout(100);
  await win.keyboard.type('Check this number again.');
  await win.keyboard.press('Escape');
  await win.click('[data-tool=select]');
  await win.waitForTimeout(400);
  await win.screenshot({ path: path.join(out, '02-annots.png') });
  console.log('annots page1:', await win.evaluate(() => JSON.stringify(window.__pdfacil.S.model.pages[0].annots.map((a) => a.type))));

  // Undo / redo
  await win.click('#viewer', { position: { x: 5, y: 5 } });
  await win.keyboard.press('Control+z');
  const afterUndo = await win.evaluate(() => window.__pdfacil.S.model.pages[0].annots.length);
  await win.keyboard.press('Control+y');
  const afterRedo = await win.evaluate(() => window.__pdfacil.S.model.pages[0].annots.length);
  console.log('undo/redo counts:', afterUndo, afterRedo);

  // Pages: rotate page 2 right, delete page 3
  await win.click('.tab[data-tab=pages]');
  await win.click('.thumb[data-idx="1"]');
  await win.click('[data-cmd=rotateRight]');
  await win.click('.thumb[data-idx="2"]');
  await win.click('[data-cmd=deletePages]');
  await win.waitForTimeout(600);
  console.log('pages now:', await win.evaluate(() => JSON.stringify(window.__pdfacil.S.model.pages.map((p) => [p.src, p.rot]))));
  await win.screenshot({ path: path.join(out, '03-pages.png') });

  // Text box on rotated page (page index 1, rotated 90)
  await win.click('.tab[data-tab=comment]');
  await win.click('[data-tool=text]');
  await win.evaluate(() => window.__pdfacil.S.pe[1].el.scrollIntoView());
  await win.waitForTimeout(300);
  const pg2 = await (await win.$('.page[data-idx="1"]')).boundingBox();
  await win.mouse.click(pg2.x + 200, pg2.y + 100);
  await win.keyboard.type('Rotated page text');
  await win.keyboard.press('Escape');
  await win.click('[data-tool=select]');

  // Zoom with ctrl+wheel
  await win.click('.tab[data-tab=view]');
  const s0 = await win.evaluate(() => window.__pdfacil.S.scale);
  await win.mouse.move(700, 450);
  await win.keyboard.down('Control');
  await win.mouse.wheel(0, -300);
  await win.keyboard.up('Control');
  await win.waitForTimeout(500);
  const s1 = await win.evaluate(() => window.__pdfacil.S.scale);
  console.log('zoom', s0.toFixed(2), '->', s1.toFixed(2));
  await win.click('[data-cmd=fitPage]');
  await win.waitForTimeout(400);

  // Search
  await win.keyboard.press('Control+f');
  await win.keyboard.type('elasticity');
  await win.waitForTimeout(1200);
  console.log('search:', await win.textContent('#searchCount'));
  await win.keyboard.press('Enter');
  await win.waitForTimeout(500);
  console.log('search after enter:', await win.textContent('#searchCount'));
  await win.screenshot({ path: path.join(out, '04-search.png') });
  await win.keyboard.press('Escape');

  // Save (Ctrl+S overwrites)
  await win.click('#viewer', { position: { x: 5, y: 5 } });
  await win.keyboard.press('Control+s');
  await win.waitForTimeout(1500);
  console.log('title:', await win.title());
  await win.click('.tab[data-tab=file]');
  await win.screenshot({ path: path.join(out, '05-saved.png') });

  console.log('ERRORS:\n' + errors.join('\n'));
  await app.close();
})().catch((e) => {
  console.error('TEST FAILED', e);
  process.exit(1);
});
