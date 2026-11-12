// PDFacil - turning highlights and comments into Markdown notes.
// Annotations are in PDF user space; pdf.js text content items are too, so the two can be compared directly.

// Text from a selection Range that lies inside one page's text layer. Line ends in the text layer are
// <br> elements, which Range.toString() drops, so the nodes are walked instead.
export function rangeTextIn(range, container) {
  if (!container || !range.intersectsNode(container)) return '';
  const r = document.createRange();
  r.selectNodeContents(container);
  if (range.compareBoundaryPoints(Range.START_TO_START, r) > 0) r.setStart(range.startContainer, range.startOffset);
  if (range.compareBoundaryPoints(Range.END_TO_END, r) < 0) r.setEnd(range.endContainer, range.endOffset);
  let out = '';
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!r.intersectsNode(n)) continue;
    if (n.nodeType === Node.ELEMENT_NODE) {
      if (n.tagName === 'BR') out += '\n';
      continue;
    }
    let s = n.data;
    if (n === r.endContainer) s = s.slice(0, r.endOffset);
    if (n === r.startContainer) s = s.slice(r.startOffset);
    out += s;
  }
  return tidy(out);
}

// Join lines, mend words hyphenated at a line end, collapse spaces.
export function tidy(s) {
  return s
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

const boxOf = (q) => {
  const xs = [q[0], q[2], q[4], q[6]];
  const ys = [q[1], q[3], q[5], q[7]];
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

// Text under a highlight's quads, worked out from the positions of the page's text. Used for highlights
// made before PDFacil kept their text, and for highlights made in other apps. Positions within a text
// item are estimated by spreading its width evenly over its characters, so whole words are taken: a word
// counts as highlighted when its middle lies inside a quad.
export function textUnderQuads(textContent, quads) {
  const boxes = quads.map(boxOf);
  const inside = (px, py) => boxes.some((bx) => px >= bx.x0 && px <= bx.x1 && py >= bx.y0 && py <= bx.y1);
  let out = '';
  let lastItem = -2;
  textContent.items.forEach((it, k) => {
    if (!it.str) {
      if (it.hasEOL && lastItem === k - 1) out += '\n';
      return;
    }
    const [a, b, c, d, e, f] = it.transform;
    const lu = Math.hypot(a, b) || 1;
    const lv = Math.hypot(c, d) || 1;
    const ux = a / lu, uy = b / lu, vx = c / lv, vy = d / lv;
    const h = it.height || lv;
    const chars = [...it.str];
    const n = chars.length;
    const words = [];
    for (let j = 0; j < n; ) {
      if (/\s/.test(chars[j])) {
        j++;
        continue;
      }
      let j2 = j;
      while (j2 < n && !/\s/.test(chars[j2])) j2++;
      const t = ((j + j2) / 2 / n) * it.width;
      if (inside(e + t * ux + 0.35 * h * vx, f + t * uy + 0.35 * h * vy)) words.push(chars.slice(j, j2).join(''));
      j = j2;
    }
    if (!words.length) return;
    // Consecutive items continue each other (a word can be split across items); others need a space.
    if (out && lastItem !== k - 1 && !/\s$/.test(out)) out += ' ';
    out += words.join(' ');
    if (it.hasEOL) out += '\n';
    lastItem = k;
  });
  return tidy(out);
}

const COLOUR_NAMES = {
  yellow: [1, 0.92, 0.23],
  green: [0.55, 0.9, 0.4],
  blue: [0.45, 0.8, 1],
  pink: [1, 0.55, 0.8],
  orange: [1, 0.6, 0.2],
  red: [0.95, 0.3, 0.3],
  purple: [0.7, 0.5, 0.95],
};
export function colourName(rgb) {
  if (!rgb) return 'yellow';
  let best = 'yellow';
  let bestD = Infinity;
  for (const [name, c] of Object.entries(COLOUR_NAMES)) {
    const dd = (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = name;
    }
  }
  return best;
}

const quote = (s) => s.split('\n').map((l) => `> ${l}`).join('\n');

// pages: [{ number (1-based PDF page), label (or null), items: [{ kind, text, comment, colour }] }]
// kind: 'highlight' | 'comment' | 'textbox'
export function notesMarkdown({ title, fileName, date, pages }) {
  const colours = new Set(pages.flatMap((p) => p.items.filter((it) => it.kind === 'highlight').map((it) => it.colour)));
  const showColour = colours.size > 1;
  const lines = [`# ${title}`, '', `Notes from *${fileName}*, exported ${date}.`];
  for (const p of pages) {
    if (!p.items.length) continue;
    const head = p.label && p.label !== String(p.number) ? `Page ${p.label} (PDF page ${p.number})` : `Page ${p.number}`;
    lines.push('', `## ${head}`);
    for (const it of p.items) {
      lines.push('');
      if (it.kind === 'highlight') {
        lines.push(quote(it.text || '[highlighted area with no text]'));
        if (showColour) lines.push('>', `> *(${it.colour})*`);
        if (it.comment) lines.push('', it.comment.trim());
      } else if (it.kind === 'comment') {
        lines.push(`**Comment:** ${it.comment.trim()}`);
      } else if (it.kind === 'textbox') {
        lines.push(`**Text on the page:** ${it.text.trim()}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}
