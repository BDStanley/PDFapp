// The iPad app's web layer (www/, built by scripts/build-web.js) in a touch browser at iPad size, with a
// stand-in for the native PDFapp plugin. Checks the plumbing the Swift plugin will carry: opening from
// Files, saving in place, Save As, notes, printing, copying, long-press menus, pinch, the selection bar,
// saving when the app goes to the background, and Zotero.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
execFileSync('node', [path.join(root, 'scripts', 'build-web.js')], { stdio: 'inherit' });
const ok = (c, m) => {
  if (!c) throw new Error('FAILED: ' + m);
  console.log('ok -', m);
};

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = path.join(www, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(www) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const sample = fs.readFileSync(path.join(__dirname, 'sample.pdf')).toString('base64');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // A stand-in for the native plugin: files in memory, every call recorded.
  await page.addInitScript((sampleB64) => {
    const calls = [];
    const listeners = {};
    const files = { 'ios://a1b2c3d4/Comparative populism.pdf': sampleB64 };
    let recent = [];
    let zConnected = false;
    window.__native = { calls, listeners, files, emit: (ev, data) => (listeners[ev] || []).forEach((cb) => cb(data)) };
    const answer = {
      info: () => ({ name: 'Ben’s iPad', version: '1.2.0' }),
      launchPath: () => ({}),
      pick: () => {
        recent.unshift({ path: 'ios://a1b2c3d4/Comparative populism.pdf', folder: 'Papers', time: Date.now() });
        return { paths: ['ios://a1b2c3d4/Comparative populism.pdf'] };
      },
      read: (o) => {
        if (!files[o.path]) throw new Error('missing');
        return { data: files[o.path] };
      },
      write: (o) => {
        files[o.path] = o.data;
        return { path: o.path };
      },
      exportFile: (o) => {
        const p = `ios://ffff0000/${o.name}`;
        files[p] = o.data;
        return { path: p };
      },
      recent: () => ({ items: recent }),
      removeRecent: () => ({}),
      confirm: () => ({ index: 0 }),
      alert: () => ({}),
      copyText: () => ({}),
      print: () => ({ ok: true }),
      backgroundDone: () => ({}),
      zoteroConfig: () => ({ connected: zConnected, userID: zConnected ? 1 : null, username: 'tester', groups: [], dataDir: '', baseDir: '', ios: true }),
      zoteroConnect: () => {
        zConnected = true;
        return answer.zoteroConfig();
      },
      zoteroRequest: (o) => {
        const j = (x) => ({ status: 200, text: JSON.stringify(x), total: Array.isArray(x) ? x.length : null, version: 5 });
        if (o.path === '/users/1/collections') return j([]);
        if (o.path === '/users/1/items/top') return j([{ key: 'ITEM0001', data: { key: 'ITEM0001', itemType: 'journalArticle', title: 'Populism in Poland' }, meta: { creatorSummary: 'Stanley', parsedDate: '2019' } }]);
        if (o.path === '/users/1/items/ITEM0001/children') return j([{ key: 'ATTACH01', data: { key: 'ATTACH01', itemType: 'attachment', contentType: 'application/pdf', title: 'Full Text PDF', filename: 'paper.pdf', parentItem: 'ITEM0001' } }]);
        if (o.path === '/users/1/items/ATTACH01/children') return j([]);
        if (o.path === '/users/1/items/ITEM0001') return j({ key: 'ITEM0001', data: { title: 'Populism in Poland' } });
        if (o.method === 'POST') return { status: 200, text: JSON.stringify({ successful: { 0: { key: 'NEWANN01', version: 6 } }, failed: {} }), version: 6 };
        return { status: 404, text: 'Not found' };
      },
      zoteroDownload: (o) => {
        const p = `zotero://users/1/${o.key}/paper.pdf`;
        files[p] = sampleB64;
        return { path: p };
      },
    };
    window.Capacitor = {
      nativePromise: (plugin, method, options) => {
        calls.push({ method, options });
        try {
          return Promise.resolve(answer[method](options || {}));
        } catch (e) {
          return Promise.reject(e);
        }
      },
      addListener: (plugin, ev, cb) => {
        (listeners[ev] ||= []).push(cb);
        return { remove() {} };
      },
    };
  }, sample);

  await page.goto(url);
  await page.waitForSelector('#welcome:not([hidden])');
  ok(await page.evaluate(() => document.documentElement.classList.contains('ios') && window.api.platform === 'ios'), 'the iPad layer is in place');
  const called = (m) => page.evaluate((m) => window.__native.calls.filter((c) => c.method === m), m);

  // Open from Files.
  await page.tap('#welcome [data-cmd=open]');
  await page.waitForFunction(() => window.__pdfapp?.S.pdf && document.querySelector('.page canvas.pc'), null, { timeout: 20000 });
  ok((await page.evaluate(() => window.__pdfapp.S.name)) === 'Comparative populism.pdf', 'a PDF picked in Files opens, under its own name');
  await page.screenshot({ path: path.join(out, 'ipad-open.png') });

  // The selection bar over selected text, then Highlight.
  await page.waitForSelector('.page[data-idx="0"] .textLayer span');
  await page.evaluate(() => {
    const spans = document.querySelectorAll('.page[data-idx="0"] .textLayer span');
    const r = document.createRange();
    r.setStart(spans[1].firstChild, 0);
    r.setEnd(spans[3].firstChild, spans[3].firstChild.length);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  });
  await page.waitForSelector('#selBubble:not([hidden])');
  await page.screenshot({ path: path.join(out, 'ipad-select.png') });
  await page.tap('#selBubble [data-b=hl]');
  ok((await page.evaluate(() => window.__pdfapp.S.model.pages[0].annots.filter((a) => a.type === 'highlight').length)) === 1, 'Highlight on the selection bar highlights');

  // Save in place.
  await page.evaluate(() => window.__pdfapp.save(false));
  const writes = await called('write');
  ok(writes.length === 1 && writes[0].options.path.startsWith('ios://a1b2c3d4/'), 'Save writes back to the same file');

  // Save As: the export sheet, and the tab follows the new file.
  await page.evaluate(() => window.__pdfapp.save(true));
  ok((await called('exportFile')).length === 1 && (await page.evaluate(() => window.__pdfapp.S.path)).startsWith('ios://ffff0000/'), 'Save As goes through the export sheet, and the tab follows the new file');

  // Copy Notes uses the iPad clipboard; Save Notes the export sheet; Print prints the PDF itself.
  await page.tap('.tab[data-tab=comment]');
  await page.tap('.panel.active [data-cmd=copyNotes]');
  await page.waitForTimeout(200);
  ok((await called('copyText')).some((c) => c.options.text.includes('## Page 1')), 'Copy Notes puts the notes on the clipboard');
  await page.tap('.panel.active [data-cmd=saveNotes]');
  await page.waitForTimeout(200);
  ok((await called('exportFile')).some((c) => c.options.name.endsWith('notes.md')), 'Save Notes offers a .md file in the export sheet');
  await page.evaluate(() => window.__pdfapp.S.pdf && document.querySelector('[data-cmd=print]').click());
  await page.waitForTimeout(300);
  ok((await called('print')).length === 1, 'Print hands the PDF to the iPad');

  // A long press on a thumbnail opens the page menu.
  const th = await (await page.$('.thumb[data-idx="1"]')).boundingBox();
  await page.evaluate(([x, y]) => {
    const t = document.elementFromPoint(x, y);
    t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: x, clientY: y, pointerId: 7 }));
  }, [th.x + th.width / 2, th.y + th.height / 2]);
  await page.waitForTimeout(700);
  ok(await page.isVisible('#ctxMenu:not([hidden])'), 'a long press opens the page menu');
  await page.screenshot({ path: path.join(out, 'ipad-longpress.png') });
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 7 })));
  await page.mouse.click(600, 400);

  // Pinch to zoom.
  const s0 = await page.evaluate(() => window.__pdfapp.S.scale);
  await page.evaluate(() => {
    const v = document.getElementById('viewer');
    const ev = (t, scale) => Object.assign(new Event(t, { bubbles: true, cancelable: true }), { scale, clientX: 500, clientY: 400 });
    v.dispatchEvent(ev('gesturestart', 1));
    v.dispatchEvent(ev('gesturechange', 1.5));
    v.dispatchEvent(ev('gestureend', 1.5));
  });
  const s1 = await page.evaluate(() => window.__pdfapp.S.scale);
  ok(Math.abs(s1 / s0 - 1.5) < 0.05, `pinching zooms the document (${s0.toFixed(2)} to ${s1.toFixed(2)})`);

  // Dragging a comment with a finger moves it.
  await page.evaluate(() => window.__pdfapp.setTool('note'));
  const pg = await (await page.$('.page[data-idx="0"]')).boundingBox();
  await page.mouse.click(pg.x + 100, pg.y + 200);
  await page.keyboard.type('Check this');
  await page.evaluate(() => window.__pdfapp.setTool('select'));
  await page.mouse.click(pg.x + 600, pg.y + 600);
  const note = () => page.evaluate(() => window.__pdfapp.S.model.pages[0].annots.find((a) => a.type === 'note'));
  const before = await note();
  const nb = await (await page.$('.ann-note')).boundingBox();
  await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    const pe = (t, cx, cy) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, clientX: cx, clientY: cy });
    el.dispatchEvent(pe('pointerdown', x, y));
    for (let k = 1; k <= 6; k++) window.dispatchEvent(pe('pointermove', x + k * 15, y + k * 10));
    window.dispatchEvent(pe('pointerup', x + 90, y + 60));
  }, [nb.x + nb.width / 2, nb.y + nb.height / 2]);
  const after = await note();
  ok(after && (Math.abs(after.x - before.x) > 20 || Math.abs(after.y - before.y) > 20), 'a comment can be dragged with a finger');

  // Going to the background saves documents that can be saved in place.
  const w0 = (await called('write')).length;
  await page.evaluate(() => window.__native.emit('background', {}));
  await page.waitForTimeout(500);
  ok((await called('write')).length > w0 && (await called('backgroundDone')).length === 1, 'going to the background saves the document, then tells iOS it is done');

  // The Page Grid's circles are always visible on the iPad.
  await page.keyboard.press('Control+Shift+G');
  await page.waitForSelector('#grid:not([hidden]) .gcell');
  ok((await page.$eval('.gcheck', (e) => getComputedStyle(e).opacity)) === '1', 'the Page Grid shows its circles for tapping');
  await page.screenshot({ path: path.join(out, 'ipad-grid.png') });
  await page.keyboard.press('Escape');

  // Zotero: settings without the Mac's folder fields, browsing, opening a paper.
  await page.evaluate(() => window.__pdfapp.openZoteroBrowser());
  await page.waitForSelector('#zoteroSetDlg:not([hidden])');
  ok(!(await page.isVisible('#zsData')), 'Zotero settings hide the Mac-only folder fields');
  await page.fill('#zsKey', 'ABCDEFGHIJKLMNOPQRSTUVWX');
  await page.tap('#zoteroSetDlg [data-cmd=zoteroSave]');
  await page.waitForSelector('#zItems li[data-key=ITEM0001]');
  await page.tap('#zItems li[data-key=ITEM0001]');
  await page.waitForSelector('#zItems [data-att=ATTACH01]');
  await page.tap('#zOpen');
  await page.waitForFunction(() => window.__pdfapp.S.zotero && window.__pdfapp.S.path.startsWith('zotero://'), null, { timeout: 15000 });
  ok(true, 'a Zotero paper downloads and opens, linked to Zotero');

  // The recent list in the welcome screen shows the folder, not the internal path.
  ok(errors.length === 0, 'no page errors ' + errors.join('; '));
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
