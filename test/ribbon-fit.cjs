// Every ribbon tab fits, without anything cut off, on an iPad in portrait (820 points) and landscape,
// and in a narrow Mac window. Draws the iPad build (www/) in a browser with a stand-in for the native plugin.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });
execFileSync('node', [path.join(root, 'scripts', 'build-web.js')], { stdio: 'ignore' });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const p = path.join(www, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(www) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404), res.end();
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
const report = process.argv.includes('--report');

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const sample = fs.readFileSync(path.join(__dirname, 'sample.pdf')).toString('base64');
  const browser = await chromium.launch();
  let worst = 0;
  for (const [w, h, label] of [[820, 1180, 'ipad-portrait'], [744, 1133, 'ipad-mini-portrait'], [1180, 820, 'ipad-landscape']]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 1 })).newPage();
    await page.addInitScript((b64) => {
      const ans = { info: () => ({ name: 'iPad', version: '1.2.0' }), launchPath: () => ({}), recent: () => ({ items: [] }), pick: () => ({ paths: ['ios://aa/Test.pdf'] }), read: () => ({ data: b64 }), zoteroConfig: () => ({ connected: false, groups: [] }) };
      window.Capacitor = { nativePromise: (p, m, o) => Promise.resolve((ans[m] || (() => ({})))(o || {})), addListener: () => ({ remove() {} }) };
    }, sample);
    await page.goto(url);
    await page.click('#welcome [data-cmd=open]');
    await page.waitForFunction(() => window.__pdfapp?.S.pdf);
    for (const tab of ['home', 'file', 'pages', 'comment', 'view']) {
      await page.click(`.tab[data-tab=${tab}]`);
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const p = document.querySelector('.panel.active');
        const right = Math.max(...[...p.querySelectorAll('.group')].map((g) => g.getBoundingClientRect().right));
        return { right: Math.round(right), width: window.innerWidth, height: Math.round(document.querySelector('#ribbon').getBoundingClientRect().height) };
      });
      const over = r.right - r.width;
      worst = Math.max(worst, over);
      console.log(`${label.padEnd(20)} ${tab.padEnd(8)} ribbon ends at ${r.right} of ${r.width}${over > 0 ? `  (${over} px cut off)` : ''}, ribbon ${r.height} px high`);
      if (label === 'ipad-portrait') await page.screenshot({ path: path.join(out, `ribbon-${label}-${tab}.png`), clip: { x: 0, y: 0, width: w, height: 200 } });
    }
  }
  await browser.close();
  server.close();
  if (!report && worst > 0) {
    console.error(`FAILED: a tab is cut off by up to ${worst} px`);
    process.exit(1);
  }
  console.log(worst > 0 ? `worst: ${worst} px cut off` : 'ok - every tab fits');
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
