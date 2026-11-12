// PDFapp - Zotero annotations (page side).
// Zotero keeps annotations as child items of a PDF attachment. Their positions are in PDF user space,
// as PDFapp's are, and refer to the page index in the original file.
import { textUnderQuads } from './notes.js';

// PDFapp's four highlight swatches written as Zotero's own colours, so they match its reader.
const PDFAPP_TO_ZOTERO = [
  [[1, 0.92, 0.23], '#ffd400'], // yellow
  [[0.55, 0.9, 0.4], '#5fb236'], // green
  [[0.45, 0.8, 1], '#2ea8e5'], // blue
  [[1, 0.55, 0.8], '#e56eee'], // pink -> magenta
];

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [1, 0.83, 0];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => Math.round(v * 1000) / 1000);
}
export function rgbToHex(rgb) {
  if (!rgb) return '#ffd400';
  for (const [c, hex] of PDFAPP_TO_ZOTERO) if (c.every((v, k) => Math.abs(v - rgb[k]) < 0.02)) return hex;
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
}

const r2 = (v) => Math.round(v * 1000) / 1000;
const quadToRect = (q) => {
  const xs = [q[0], q[2], q[4], q[6]];
  const ys = [q[1], q[3], q[5], q[7]];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r2);
};
const rectToQuad = ([x1, y1, x2, y2]) => [x1, y2, x2, y2, x1, y1, x2, y1];

// Text box (top-left corner x,y, width w, height h, drawn at view rotation rot) <-> its bounding rect.
function textRect(a) {
  const rad = ((a.rot || 0) * Math.PI) / 180;
  const c = Math.round(Math.cos(rad));
  const s = Math.round(Math.sin(rad));
  const p = (dx, dy) => [a.x + c * dx + s * dy, a.y + s * dx - c * dy];
  const pts = [p(0, 0), p(a.w, 0), p(0, a.h), p(a.w, a.h)];
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r2);
}
function textFromRect([x1, y1, x2, y2], rot) {
  switch (((rot % 360) + 360) % 360) {
    case 90:
      return { x: x1, y: y1, w: y2 - y1, h: x2 - x1 };
    case 180:
      return { x: x2, y: y1, w: x2 - x1, h: y2 - y1 };
    case 270:
      return { x: x2, y: y2, w: y2 - y1, h: x2 - x1 };
    default:
      return { x: x1, y: y2, w: x2 - x1, h: y2 - y1 };
  }
}

const NOTE_HALF = 11; // Zotero draws comments as 22-point squares

// Zotero item -> PDFapp annotation (with z: true), or null for kinds PDFapp cannot show (ink, image).
export function fromZotero(item, newId) {
  const d = item.data || item;
  let pos;
  try {
    pos = typeof d.annotationPosition === 'string' ? JSON.parse(d.annotationPosition) : d.annotationPosition;
  } catch {
    return null;
  }
  if (!pos || !Array.isArray(pos.rects) || !pos.rects.length) return null;
  const base = { id: newId(), z: true };
  const color = hexToRgb(d.annotationColor);
  const t = d.annotationType;
  if (t === 'highlight' || t === 'underline') {
    const a = { ...base, type: 'highlight', quads: pos.rects.map(rectToQuad), color, contents: d.annotationComment || '' };
    if (d.annotationText) a.text = d.annotationText;
    if (t === 'underline') a.ztype = 'underline';
    return { annot: a, pageIndex: pos.pageIndex };
  }
  if (t === 'note') {
    const [x1, y1, x2, y2] = pos.rects[0];
    return { annot: { ...base, type: 'note', x: r2((x1 + x2) / 2), y: r2((y1 + y2) / 2), contents: d.annotationComment || '', color }, pageIndex: pos.pageIndex };
  }
  if (t === 'text') {
    const rot = pos.rotation || 0;
    const g = textFromRect(pos.rects[0], rot);
    const size = pos.fontSize || 12;
    return {
      annot: { ...base, type: 'text', ...g, rot, text: d.annotationComment || '', size, font: 'helv', color },
      pageIndex: pos.pageIndex,
    };
  }
  return null;
}

const pad = (n, w) => String(Math.max(0, Math.round(n))).padStart(w, '0').slice(-w);

// PDFapp annotation -> Zotero annotation fields. page: { index, label, top } (top = the page's top edge in user space).
export function toZotero(a, page) {
  let rects;
  let extra = {};
  let type = a.type;
  let comment = a.contents || '';
  let text;
  if (a.type === 'highlight') {
    rects = a.quads.map(quadToRect);
    type = a.ztype || 'highlight';
    text = a.text || '';
  } else if (a.type === 'note') {
    rects = [[a.x - NOTE_HALF, a.y - NOTE_HALF, a.x + NOTE_HALF, a.y + NOTE_HALF].map(r2)];
  } else if (a.type === 'text') {
    rects = [textRect(a)];
    extra = { fontSize: a.size, rotation: a.rot || 0 };
    comment = a.text || '';
  } else return null;
  const top = Math.max(...rects.map((r) => r[3]));
  const left = Math.min(...rects.map((r) => r[0]));
  const out = {
    annotationType: type,
    annotationComment: comment,
    annotationColor: rgbToHex(a.color),
    annotationPageLabel: page.label,
    annotationSortIndex: `${pad(page.index, 5)}|${pad(left, 6)}|${pad(page.top - top, 5)}`,
    annotationPosition: JSON.stringify({ pageIndex: page.index, rects, ...extra }),
  };
  if (text !== undefined) out.annotationText = text;
  return out;
}

const keyedJson = (o) => JSON.stringify(Object.keys(o).sort().reduce((m, k) => ((m[k] = o[k]), m), {}));

// ------------------------------------------------------------------ sync
// One ZoteroLink per open Zotero document. It knows the last state written to (or read from) Zotero for
// each annotation, keyed by PDFapp's annotation id, so it can tell what changed on either side.
export class ZoteroLink {
  constructor({ lib, attKey, itemKey, title }, owner, hooks) {
    Object.assign(this, { lib, attKey, itemKey, title });
    this.owner = owner; // () => the doc object ({ model, pdf, pdfPages }) this link belongs to
    this.hooks = hooks; // { api, newId, refresh(pages), state(text, kind) }
    this.synced = new Map(); // annotation id -> { key, version, json }
    this.gen = 0; // bumped on every local change
    this.pushedGen = 0;
    this.busy = null;
    this.timer = null;
    this.lastPull = 0;
    this.hidden = 0; // annotations Zotero has that PDFapp cannot show
    this.state = '';
  }

  get pending() {
    return this.gen !== this.pushedGen;
  }

  async pageInfo() {
    const doc = this.owner();
    if (!this.labels) this.labels = (await doc.pdf.getPageLabels().catch(() => null)) || [];
    return (src) => ({
      index: src,
      label: this.labels[src] || String(src + 1),
      top: doc.pdfPages[src]?.view?.[3] ?? 792,
    });
  }

  setState(text, kind) {
    this.state = text;
    this.hooks.state(this, text, kind);
  }

  // Current Zotero annotations of the document: id -> { a, src, data, json }
  async current() {
    const doc = this.owner();
    const info = await this.pageInfo();
    const cur = new Map();
    for (const mp of doc.model.pages) {
      for (const a of mp.annots) {
        if (!a.z) continue;
        if (a.type === 'highlight' && !a.text) {
          try {
            a.text = textUnderQuads(await doc.pdfPages[mp.src].getTextContent(), a.quads) || undefined;
          } catch {}
        }
        if (a.type === 'text' && !a.text?.trim()) continue; // an empty text box is not kept
        const data = toZotero(a, info(mp.src));
        if (data) cur.set(a.id, { a, src: mp.src, data, json: keyedJson(data) });
      }
    }
    return cur;
  }

  async fetchAll() {
    const items = [];
    for (let start = 0; ; start += 100) {
      const r = await this.hooks.api('GET', `${this.lib}/items/${this.attKey}/children`, {
        query: { itemType: 'annotation', limit: 100, start },
      });
      if (r.offline) throw Object.assign(new Error('offline'), { offline: true });
      if (r.status !== 200) throw new Error(`Zotero answered ${r.status} when asked for the annotations.`);
      items.push(...r.data);
      if (r.data.length < 100) break;
    }
    return items;
  }

  // Bring in changes made elsewhere. Local changes not yet sent win over remote ones.
  async pull() {
    await this.busy;
    this.busy = this._pull();
    try {
      return await this.busy;
    } finally {
      this.busy = null;
    }
  }

  async _pull() {
    this.setState('Checking Zotero…', 'busy');
    let items;
    try {
      items = await this.fetchAll();
    } catch (e) {
      this.setState(e.offline ? 'Zotero: offline' : `Zotero: ${e.message}`, 'error');
      return false;
    }
    this.lastPull = Date.now();
    const doc = this.owner();
    const info = await this.pageInfo();
    const remote = new Map(items.map((it) => [it.key, it]));
    const cur = await this.current();
    const byKey = new Map([...this.synced].map(([id, s]) => [s.key, id]));
    const touched = new Set();
    const pageOfSrc = (src) => doc.model.pages.findIndex((p) => p.src === src);
    let hidden = 0;

    // Annotations PDFapp already has from Zotero.
    for (const [id, s] of [...this.synced]) {
      const r = remote.get(s.key);
      const c = cur.get(id);
      const localChanged = !c || c.json !== s.json;
      const i = doc.model.pages.findIndex((p) => p.annots.some((a) => a.id === id));
      if (!r) {
        // Deleted in Zotero. Keep it only if it was changed here since (it will be sent again as new).
        if (!localChanged && i >= 0) {
          doc.model.pages[i].annots = doc.model.pages[i].annots.filter((a) => a.id !== id);
          touched.add(i);
        }
        this.synced.delete(id);
        continue;
      }
      if (r.version > s.version && !localChanged) {
        const conv = fromZotero(r, () => id);
        if (!conv) continue;
        const j = pageOfSrc(conv.pageIndex);
        if (i >= 0) doc.model.pages[i].annots = doc.model.pages[i].annots.filter((a) => a.id !== id);
        if (j >= 0) {
          doc.model.pages[j].annots.push(conv.annot);
          touched.add(j);
        }
        if (i >= 0) touched.add(i);
        this.synced.set(id, { key: r.key, version: r.version, json: keyedJson(toZotero(conv.annot, info(conv.pageIndex))) });
      }
    }
    // Annotations new to PDFapp.
    for (const r of items) {
      if (byKey.has(r.key)) continue;
      const conv = fromZotero(r, this.hooks.newId);
      if (!conv) {
        hidden++;
        continue;
      }
      const j = pageOfSrc(conv.pageIndex);
      if (j < 0) continue;
      doc.model.pages[j].annots.push(conv.annot);
      touched.add(j);
      this.synced.set(conv.annot.id, { key: r.key, version: r.version, json: keyedJson(toZotero(conv.annot, info(conv.pageIndex))) });
    }
    this.hidden = hidden;
    if (touched.size) this.hooks.refresh(this, [...touched]);
    // Anything changed here meanwhile still needs sending.
    const after = await this.current();
    const unsent = [...after].some(([id, c]) => this.synced.get(id)?.json !== c.json) || [...this.synced.keys()].some((id) => !after.has(id));
    if (unsent) {
      this.gen++;
      this.schedule(0);
    } else this.setState('Zotero: up to date', 'ok');
    return true;
  }

  // Note a local change and send it shortly.
  touch() {
    this.gen++;
    this.schedule();
  }

  schedule(ms = 1200) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push().catch(() => {}), ms);
  }

  // Send local changes now. Resolves to true when Zotero has everything.
  async push() {
    clearTimeout(this.timer);
    await this.busy;
    if (!this.pending) return true;
    this.busy = this._push();
    try {
      return await this.busy;
    } finally {
      this.busy = null;
    }
  }

  async _push() {
    const gen = this.gen;
    this.setState('Saving to Zotero…', 'busy');
    const cur = await this.current();
    const api = this.hooks.api;
    const creates = [];
    const updates = [];
    const deletes = [];
    for (const [id, c] of cur) {
      const s = this.synced.get(id);
      if (!s) creates.push([id, c]);
      else if (s.json !== c.json) updates.push([id, c, s]);
    }
    for (const [id, s] of this.synced) if (!cur.has(id)) deletes.push([id, s]);

    const fail = (r) => {
      if (r.offline) throw Object.assign(new Error('offline'), { offline: true });
      throw new Error(r.data?.message || (typeof r.data === 'string' && r.data) || `Zotero answered ${r.status}`);
    };
    try {
      for (let k = 0; k < creates.length; k += 50) {
        const chunk = creates.slice(k, k + 50);
        const body = chunk.map(([, c]) => ({ itemType: 'annotation', parentItem: this.attKey, tags: [], ...c.data }));
        const r = await api('POST', `${this.lib}/items`, { body });
        if (r.status !== 200) fail(r);
        chunk.forEach(([id, c], n) => {
          const ok = r.data?.successful?.[n];
          if (ok) this.synced.set(id, { key: ok.key, version: ok.version ?? r.version, json: c.json });
        });
        const failed = Object.values(r.data?.failed || {});
        if (failed.length) throw new Error(failed[0].message || 'Zotero refused an annotation.');
      }
      for (const [id, c, s] of updates) {
        let r = await api('PATCH', `${this.lib}/items/${s.key}`, { body: c.data, headers: { 'If-Unmodified-Since-Version': String(s.version) } });
        if (r.status === 412) {
          // Changed in Zotero meanwhile: the edit made here wins.
          const g = await api('GET', `${this.lib}/items/${s.key}`);
          if (g.status === 200) r = await api('PATCH', `${this.lib}/items/${s.key}`, { body: c.data, headers: { 'If-Unmodified-Since-Version': String(g.data.version) } });
          else if (g.status === 404) r = { status: 404 };
        }
        if (r.status === 404) {
          this.synced.delete(id); // deleted in Zotero: send it again as new next time
          this.gen++;
          continue;
        }
        if (r.status !== 204) fail(r);
        this.synced.set(id, { key: s.key, version: r.version || s.version, json: c.json });
      }
      for (const [id, s] of deletes) {
        let r = await api('DELETE', `${this.lib}/items/${s.key}`, { headers: { 'If-Unmodified-Since-Version': String(s.version) } });
        if (r.status === 412) {
          const g = await api('GET', `${this.lib}/items/${s.key}`);
          r = g.status === 200 ? await api('DELETE', `${this.lib}/items/${s.key}`, { headers: { 'If-Unmodified-Since-Version': String(g.data.version) } }) : { status: 404 };
        }
        if (r.status !== 204 && r.status !== 404) fail(r);
        this.synced.delete(id);
      }
    } catch (e) {
      if (e.offline) {
        this.setState('Zotero: offline, will try again', 'error');
        this.schedule(30000);
      } else this.setState(`Zotero: ${e.message}`, 'error');
      return false;
    }
    if (this.gen === gen) this.pushedGen = gen;
    else this.schedule(300);
    this.setState('Zotero: saved', 'ok');
    return !this.pending;
  }
}
