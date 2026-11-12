// Annotations saved by PDFacil (marker PDFacilData) still open in PDFapp, and are saved back under PDFappData.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfapp-compat-'));
const pdf = path.join(tmp, 'old.pdf');
fs.copyFileSync(path.join(__dirname, 'sample.pdf'), pdf);
const ok = (c, m) => {
  if (!c) throw new Error('FAILED: ' + m);
  console.log('ok -', m);
};

(async () => {
  const app = await electron.launch({ executablePath: require(path.join(root, 'node_modules', 'electron')), args: ['--no-sandbox', root, pdf], env: { ...process.env, PDFAPP_USER_DATA: path.join(tmp, 'ud') } });
  const win = await app.firstWindow();
  await win.waitForFunction(() => window.__pdfapp?.S.pdf);
  // A text box and a comment, saved, then rewritten as PDFacil would have written them.
  const bytes = await win.evaluate(async () => {
    const { S, buildPdf } = window.__pdfapp;
    S.model.pages[0].annots.push({ id: 'x1', type: 'note', x: 100, y: 500, contents: 'Saved by PDFacil', color: [1, 0.85, 0.2] });
    S.model.pages[1].annots.push({ id: 'x2', type: 'text', x: 80, y: 700, w: 200, h: 20, rot: 0, text: 'Old text box', size: 12, font: 'helv', color: [0, 0, 0] });
    const out = await buildPdf(S.baseBytes, S.model, 'Tester');
    const doc = await PDFLib.PDFDocument.load(out);
    let n = 0;
    for (const page of doc.getPages()) {
      const annots = page.node.Annots();
      if (!annots) continue;
      for (let k = 0; k < annots.size(); k++) {
        const d = doc.context.lookup(annots.get(k));
        const v = d.get(PDFLib.PDFName.of('PDFappData'));
        if (v) {
          d.set(PDFLib.PDFName.of('PDFacilData'), v);
          d.delete(PDFLib.PDFName.of('PDFappData'));
          n++;
        }
      }
    }
    return { n, bytes: Array.from(await doc.save()) };
  });
  ok(bytes.n === 2, 'two annotations rewritten with the old marker');
  const oldFile = path.join(tmp, 'saved-by-pdfacil.pdf');
  fs.writeFileSync(oldFile, Buffer.from(bytes.bytes));
  await win.evaluate((p) => window.__pdfapp.openPath(p), oldFile);
  await win.waitForFunction(() => window.__pdfapp.S.name === 'saved-by-pdfacil.pdf');
  const got = await win.evaluate(() => window.__pdfapp.S.model.pages.flatMap((p) => p.annots).map((a) => a.contents || a.text));
  ok(got.includes('Saved by PDFacil') && got.includes('Old text box'), 'PDFapp reads them as its own, editable annotations');
  await win.evaluate(() => window.__pdfapp.save(false));
  const resaved = await win.evaluate(async (p) => {
    const doc = await PDFLib.PDFDocument.load(new Uint8Array(await window.api.readBytes(p)));
    let fresh = 0, old = 0;
    for (const page of doc.getPages()) {
      const annots = page.node.Annots();
      for (let k = 0; annots && k < annots.size(); k++) {
        const d = doc.context.lookup(annots.get(k));
        if (d.get(PDFLib.PDFName.of('PDFappData'))) fresh++;
        if (d.get(PDFLib.PDFName.of('PDFacilData'))) old++;
      }
    }
    return { fresh, old };
  }, oldFile);
  ok(resaved.fresh === 2 && resaved.old === 0, 'saving writes them under the new marker, once each');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].destroy());
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
