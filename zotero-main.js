// PDFacil - Zotero connection (main process).
// The API key never reaches the page: it is stored encrypted with Electron's safeStorage (the macOS
// Keychain, or the Windows user's DPAPI key) and added to requests here. The page can only reach the
// libraries the key gives access to.
const { app, ipcMain, net, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const API = (process.env.ZOTERO_API_BASE || 'https://api.zotero.org').replace(/\/$/, '');
const cfgFile = () => path.join(app.getPath('userData'), 'zotero.json');
const cacheDir = () => path.join(app.getPath('userData'), 'zotero-cache');
const defaultDataDir = () => path.join(os.homedir(), 'Zotero');

let cfg = null; // { keyEnc, keyPlain?, userID, username, dataDir, baseDir, groups: [{ id, name }] }

function loadCfg() {
  if (cfg) return cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgFile(), 'utf8'));
  } catch {
    cfg = {};
  }
  return cfg;
}
function saveCfg() {
  fs.mkdirSync(path.dirname(cfgFile()), { recursive: true });
  fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
}
function apiKey() {
  const c = loadCfg();
  if (c.keyEnc) {
    try {
      return safeStorage.decryptString(Buffer.from(c.keyEnc, 'base64'));
    } catch {
      return null;
    }
  }
  return c.keyPlain || null;
}

async function call(method, urlPath, { query, body, headers = {} } = {}, key = apiKey()) {
  if (!key) throw new Error('PDFacil is not connected to Zotero.');
  const url = new URL(API + urlPath);
  for (const [k, v] of Object.entries(query || {})) if (v != null && v !== '') url.searchParams.set(k, String(v));
  const h = { 'Zotero-API-Key': key, 'Zotero-API-Version': '3', ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  let res;
  try {
    res = await net.fetch(url.toString(), { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    return { status: 0, offline: true, error: String(e?.message || e) };
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return {
    status: res.status,
    version: Number(res.headers.get('Last-Modified-Version')) || null,
    total: Number(res.headers.get('Total-Results')) || null,
    backoff: Number(res.headers.get('Backoff') || res.headers.get('Retry-After')) || null,
    data,
  };
}

// Only the user's own library and the groups the key can reach.
function allowedPath(p) {
  const c = loadCfg();
  if (typeof p !== 'string' || p.includes('..')) return false;
  if (p.startsWith(`/users/${c.userID}/`)) return true;
  const m = /^\/groups\/(\d+)\//.exec(p);
  return !!(m && (c.groups || []).some((g) => String(g.id) === m[1]));
}

function publicCfg() {
  const c = loadCfg();
  return {
    connected: !!(c.userID && apiKey()),
    userID: c.userID || null,
    username: c.username || null,
    dataDir: c.dataDir || defaultDataDir(),
    baseDir: c.baseDir || '',
    groups: c.groups || [],
    encrypted: !!c.keyEnc,
  };
}

async function fetchGroups(key, userID) {
  const r = await call('GET', `/users/${userID}/groups`, { query: { limit: 100 } }, key);
  if (r.status !== 200 || !Array.isArray(r.data)) return [];
  return r.data.map((g) => ({ id: g.id, name: g.data?.name || `Group ${g.id}` }));
}

const MAX_DOWNLOAD = 500 * 1024 * 1024;

// One request that reports a redirect instead of following it.
function firstHop(url, headers) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, redirect: 'manual' });
    for (const [k, v] of Object.entries(headers)) req.setHeader(k, v);
    req.on('redirect', (_status, _method, redirectUrl) => {
      resolve({ redirect: redirectUrl });
      req.abort();
    });
    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function download(lib, attKey) {
  let res;
  try {
    // The API key goes only to Zotero, not on to the file host it redirects to.
    const hop = await firstHop(`${API}${lib}/items/${attKey}/file`, { 'Zotero-API-Key': apiKey(), 'Zotero-API-Version': '3' });
    if (hop.redirect) {
      const r = await net.fetch(new URL(hop.redirect, API).toString());
      res = { status: r.status, ok: r.ok, body: Buffer.from(await r.arrayBuffer()) };
    } else res = { status: hop.status, ok: hop.status >= 200 && hop.status < 300, body: hop.body };
  } catch (e) {
    throw new Error(`Could not download the PDF from Zotero (${e?.message || e}).`);
  }
  if (res.status === 404) {
    throw new Error(
      'Zotero has no copy of this PDF online. If you sync files with WebDAV or keep them as linked files, ' +
        'set the Zotero data folder (and the linked-files folder) in PDFacil\'s Zotero settings so PDFacil can find the file on this computer.',
    );
  }
  if (!res.ok) throw new Error(`Zotero answered ${res.status} when asked for the PDF.`);
  const buf = res.body;
  if (buf.length > MAX_DOWNLOAD) throw new Error('The PDF is too large to download.');
  const dir = path.join(cacheDir(), lib.replace(/\//g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${attKey}.pdf`);
  fs.writeFileSync(out, buf);
  return out;
}

function register() {
  ipcMain.handle('zotero:config', () => publicCfg());

  ipcMain.handle('zotero:connect', async (_e, key, dataDir, baseDir) => {
    key = String(key || '').trim();
    if (!/^[A-Za-z0-9]{10,64}$/.test(key)) throw new Error('That does not look like a Zotero API key.');
    const r = await call('GET', '/keys/current', {}, key);
    if (r.offline) throw new Error('Could not reach Zotero. Check the internet connection.');
    if (r.status === 403 || r.status === 404) throw new Error('Zotero did not accept this key.');
    if (r.status !== 200 || !r.data?.userID) throw new Error(`Zotero answered ${r.status}.`);
    const access = r.data.access || {};
    if (!access.user?.library) throw new Error('This key cannot read your library. Create a key with "Allow library access".');
    if (!access.user?.write) throw new Error('This key cannot write to your library. Create a key with "Allow write access", so annotations can be saved.');
    cfg = loadCfg();
    if (safeStorage.isEncryptionAvailable()) {
      cfg.keyEnc = safeStorage.encryptString(key).toString('base64');
      delete cfg.keyPlain;
    } else {
      cfg.keyPlain = key; // still only readable by this user (file mode 600)
      delete cfg.keyEnc;
    }
    cfg.userID = r.data.userID;
    cfg.username = r.data.username || '';
    cfg.dataDir = dataDir || cfg.dataDir || defaultDataDir();
    cfg.baseDir = baseDir || '';
    cfg.groups = await fetchGroups(key, cfg.userID);
    saveCfg();
    return publicCfg();
  });

  ipcMain.handle('zotero:folders', (_e, dataDir, baseDir) => {
    cfg = loadCfg();
    cfg.dataDir = dataDir || defaultDataDir();
    cfg.baseDir = baseDir || '';
    saveCfg();
    return publicCfg();
  });

  ipcMain.handle('zotero:disconnect', () => {
    cfg = loadCfg();
    for (const k of ['keyEnc', 'keyPlain', 'userID', 'username', 'groups']) delete cfg[k];
    saveCfg();
    return publicCfg();
  });

  ipcMain.handle('zotero:api', async (_e, method, p, opts) => {
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) throw new Error('Bad method');
    if (!allowedPath(p)) throw new Error('Not a library this key can reach.');
    return call(method, p, opts || {});
  });

  // Where is this attachment's PDF? The local Zotero storage first, then a download.
  ipcMain.handle('zotero:file', async (_e, lib, attKey, data) => {
    if (!allowedPath(`${lib}/`) || !/^[A-Z0-9]{8}$/.test(attKey)) throw new Error('Bad attachment');
    const c = publicCfg();
    const mode = data?.linkMode;
    if (mode === 'linked_file') {
      let p = data.path || '';
      if (p.startsWith('attachments:')) {
        if (!c.baseDir) throw new Error('This PDF is a linked file stored relative to Zotero\'s linked-files folder. Set that folder in PDFacil\'s Zotero settings.');
        p = path.join(c.baseDir, p.slice('attachments:'.length));
      }
      if (p && fs.existsSync(p)) return { path: p, local: true };
      throw new Error(`The linked file was not found on this computer:\n${p}`);
    }
    if (data?.filename) {
      const p = path.join(c.dataDir, 'storage', attKey, data.filename);
      if (fs.existsSync(p)) return { path: p, local: true };
    }
    // The storage folder can hold the file under a different name.
    const dir = path.join(c.dataDir, 'storage', attKey);
    try {
      const pdf = fs.readdirSync(dir).find((f) => /\.pdf$/i.test(f));
      if (pdf) return { path: path.join(dir, pdf), local: true };
    } catch {}
    return { path: await download(lib, attKey), local: false };
  });

  // Is this file in the Zotero storage folder? Then its folder name is the attachment key.
  ipcMain.handle('zotero:key-for-path', (_e, p) => {
    const c = publicCfg();
    if (!c.connected || !p) return null;
    const storage = path.resolve(c.dataDir, 'storage') + path.sep;
    const abs = path.resolve(p);
    if (!abs.startsWith(storage)) return null;
    const key = abs.slice(storage.length).split(path.sep)[0];
    return /^[A-Z0-9]{8}$/.test(key) ? key : null;
  });
}

module.exports = { register };
