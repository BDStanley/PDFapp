// A small stand-in for the Zotero web API (api.zotero.org), enough for PDFacil's tests.
const http = require('http');

function createMock(pdfBytes) {
  const KEY = 'TESTKEY1234567890abcdef';
  let libVersion = 10;
  const items = new Map();
  const add = (key, data) => items.set(key, { key, version: ++libVersion, data: { key, ...data }, meta: {} });

  add('COLLITEM', { itemType: 'journalArticle', title: 'Populism and polarisation in Poland', publicationTitle: 'East European Politics' });
  items.get('COLLITEM').meta = { creatorSummary: 'Stanley', parsedDate: '2019-03-01' };
  add('ATTACH01', { itemType: 'attachment', parentItem: 'COLLITEM', linkMode: 'imported_file', contentType: 'application/pdf', filename: 'paper.pdf', title: 'Full Text PDF' });
  add('REMOTE01', {
    itemType: 'annotation', parentItem: 'ATTACH01', annotationType: 'highlight',
    annotationText: 'Remote highlight text', annotationComment: 'Made in Zotero', annotationColor: '#5fb236',
    annotationPageLabel: '1', annotationSortIndex: '00000|000100|00100',
    annotationPosition: JSON.stringify({ pageIndex: 0, rects: [[72, 600, 300, 614]] }),
  });
  add('INKANNOT', {
    itemType: 'annotation', parentItem: 'ATTACH01', annotationType: 'ink', annotationColor: '#000000',
    annotationPageLabel: '1', annotationSortIndex: '00000|000000|00000',
    annotationPosition: JSON.stringify({ pageIndex: 0, width: 2, paths: [[10, 10, 20, 20]] }),
  });

  const log = [];
  let seq = 0;
  const newKey = () => 'NEW' + String(++seq).padStart(5, '0');

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const send = (status, data, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Last-Modified-Version': String(libVersion), ...headers });
        res.end(data === undefined ? '' : JSON.stringify(data));
      };
      if (url.pathname === '/s3/file') {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        return res.end(pdfBytes);
      }
      if (req.headers['zotero-api-key'] !== KEY) return send(403, 'Forbidden');
      log.push(`${req.method} ${url.pathname}${url.search}`);
      const p = url.pathname;
      const m = (re) => re.exec(p);
      const list = (arr) => {
        const start = Number(url.searchParams.get('start') || 0);
        const limit = Number(url.searchParams.get('limit') || 25);
        send(200, arr.slice(start, start + limit), { 'Total-Results': String(arr.length) });
      };
      if (p === '/keys/current') return send(200, { userID: 1, username: 'tester', access: { user: { library: true, write: true } } });
      if (p === '/users/1/groups') return send(200, []);
      if (p === '/users/1/collections') return list([{ key: 'COLL0001', data: { key: 'COLL0001', name: 'Polarisation', parentCollection: false } }]);
      if (p === '/users/1/items/top' || p === '/users/1/collections/COLL0001/items/top') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        return list([...items.values()].filter((it) => it.key === 'COLLITEM' && it.data.title.toLowerCase().includes(q)));
      }
      let r;
      if ((r = m(/^\/users\/1\/items\/([A-Z0-9]{8})\/file$/))) return send(302, undefined, { Location: '/s3/file' });
      if ((r = m(/^\/users\/1\/items\/([A-Z0-9]{8})\/children$/))) {
        const type = url.searchParams.get('itemType');
        return list([...items.values()].filter((it) => it.data.parentItem === r[1] && (!type || it.data.itemType === type)));
      }
      if (req.method === 'POST' && p === '/users/1/items') {
        const arr = JSON.parse(body);
        const successful = {};
        arr.forEach((d, n) => {
          const key = newKey();
          add(key, d);
          successful[n] = { key, version: libVersion };
        });
        return send(200, { successful, success: {}, unchanged: {}, failed: {} });
      }
      if ((r = m(/^\/users\/1\/items\/([A-Z0-9]{8})$/))) {
        const it = items.get(r[1]);
        if (!it) return send(404, 'Not found');
        if (req.method === 'GET') return send(200, it);
        const want = Number(req.headers['if-unmodified-since-version']);
        if (want !== it.version) return send(412, 'Item has been modified');
        if (req.method === 'PATCH') {
          Object.assign(it.data, JSON.parse(body));
          it.version = ++libVersion;
          return send(204);
        }
        if (req.method === 'DELETE') {
          items.delete(r[1]);
          ++libVersion;
          return send(204);
        }
      }
      send(404, 'Not found');
    });
  });
  return {
    KEY,
    items,
    log,
    server,
    // A change made "in Zotero" by someone else.
    remoteEdit(key, data) {
      const it = items.get(key);
      Object.assign(it.data, data);
      it.version = ++libVersion;
    },
    annotations: () => [...items.values()].filter((it) => it.data.itemType === 'annotation'),
  };
}

module.exports = { createMock };
