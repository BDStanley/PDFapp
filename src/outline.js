// PDFacil - document outline panel (built-in PDF bookmarks, or headings detected from font sizes).

/** Resolve a PDF.js outline tree into { title, target: { src, top, left }, children } items. */
async function resolveItems(pdf, items, level, parent) {
  const out = [];
  for (const it of items || []) {
    const node = { title: (it.title || '').trim() || '(untitled)', bold: it.bold, italic: it.italic, url: it.url || null, target: null, level, parent, children: [], open: false };
    try {
      let dest = it.dest;
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (Array.isArray(dest) && dest.length) {
        const ref = dest[0];
        const src = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref);
        const mode = dest[1]?.name;
        let top = null;
        let left = null;
        if (mode === 'XYZ') {
          left = dest[2];
          top = dest[3];
        } else if (mode === 'FitH' || mode === 'FitBH') {
          top = dest[2];
        } else if (mode === 'FitR') {
          left = dest[2];
          top = dest[5];
        }
        node.target = { src, top: typeof top === 'number' ? top : null, left: typeof left === 'number' ? left : null };
      }
    } catch {
      /* broken destination: keep the title, just not clickable */
    }
    node.children = await resolveItems(pdf, it.items, level + 1, node);
    out.push(node);
  }
  return out;
}

/**
 * No bookmarks in the file: find headings by font size. Lines noticeably larger than
 * the body text become entries; the 3 largest sizes become levels 1-3.
 */
async function detectHeadings(pdfPages, getText, onProgress) {
  const lines = [];
  const sizeChars = new Map();
  for (let src = 0; src < pdfPages.length; src++) {
    if (onProgress && src % 10 === 0) onProgress(src, pdfPages.length);
    const tc = await getText(src);
    const byLine = new Map();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const [a, b, , , , y] = it.transform;
      if (Math.abs(b) > 0.01 * Math.abs(a)) continue; // skip rotated text
      const size = Math.round(Math.abs(it.height || Math.hypot(it.transform[2], it.transform[3])) * 2) / 2;
      if (!size) continue;
      sizeChars.set(size, (sizeChars.get(size) || 0) + it.str.length);
      const key = `${Math.round(y)}|${size}`;
      if (!byLine.has(key)) byLine.set(key, { src, y, size, parts: [] });
      byLine.get(key).parts.push({ x: it.transform[4], s: it.str });
    }
    for (const l of byLine.values()) {
      l.text = l.parts.sort((p, q) => p.x - q.x).map((p) => p.s).join('').replace(/\s+/g, ' ').trim();
      lines.push(l);
    }
  }
  if (!lines.length) return [];
  let body = 0;
  let best = -1;
  for (const [size, n] of sizeChars) if (n > best) [body, best] = [size, n];

  // Candidate heading lines, top to bottom on each page.
  let cand = lines
    .filter((l) => l.size >= body * 1.12 && l.text.length >= 2 && l.text.length <= 140 && /\p{L}/u.test(l.text))
    .sort((p, q) => p.src - q.src || q.y - p.y);
  // Join headings that wrap onto two lines.
  const merged = [];
  for (const l of cand) {
    const prev = merged[merged.length - 1];
    if (prev && prev.src === l.src && prev.size === l.size && prev.lastY - l.y > 0 && prev.lastY - l.y < l.size * 1.7 && prev.text.length < 140) {
      prev.text += ' ' + l.text;
      prev.lastY = l.y;
    } else merged.push({ ...l, lastY: l.y });
  }
  // Drop running headers that repeat on many pages.
  const count = new Map();
  for (const m of merged) count.set(m.text, (count.get(m.text) || 0) + 1);
  const pages = pdfPages.length;
  cand = merged.filter((m) => !(count.get(m.text) >= 3 && count.get(m.text) >= pages * 0.3));
  const sizes = [...new Set(cand.map((m) => m.size))].sort((p, q) => q - p).slice(0, cand.length > 250 ? 2 : 3);
  cand = cand.filter((m) => sizes.includes(m.size));

  // Build a tree from the levels.
  const roots = [];
  const stack = [];
  for (const m of cand) {
    const level = sizes.indexOf(m.size) + 1;
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1] || null;
    const node = { title: m.text, target: { src: m.src, top: m.y + m.size, left: null }, level, parent, children: [], open: false };
    (parent ? parent.children : roots).push(node);
    stack.push(node);
  }
  return roots;
}

/** Load (once per document) the outline: { auto, items } . */
export async function loadOutline(pdf, pdfPages, getText, onProgress) {
  let raw = null;
  try {
    raw = await pdf.getOutline();
  } catch {}
  if (raw && raw.length) return { auto: false, items: await resolveItems(pdf, raw, 1, null) };
  return { auto: true, items: await detectHeadings(pdfPages, getText, onProgress) };
}

export function flatten(items, out = []) {
  for (const it of items) {
    out.push(it);
    flatten(it.children, out);
  }
  return out;
}

/** Open the first levels if the outline is short, otherwise only show the top level. */
export function setInitialOpen(items) {
  const total = flatten(items).length;
  const depth = total <= 80 ? 2 : 1;
  for (const it of flatten(items)) it.open = it.level < depth && it.children.length > 0;
}
