// PDFapp on the iPad: the same window.api the desktop app gets from preload.js, built on the native
// PDFapp plugin (ios/App/App/PDFappPlugin.swift) through Capacitor's bridge.
//
// Paths. The desktop app passes file paths around; here a "path" is an identifier the plugin can turn
// back into the file, ending in the file name so the app's name handling keeps working:
//   ios://<id>/<name>          a file anywhere in Files, kept by a security-scoped bookmark (read and saved in place)
//   zotero://<lib>/<key>/<name> a PDF downloaded from Zotero (read only)
//   mem://<n>/<name>           a file dropped onto the app, held in memory (Save asks where to save it)
//   new://<n>/<name>           a destination not chosen yet: writing to it asks where to save, with the
//                              Files export sheet, and returns the real path.
(function () {
  const cap = window.Capacitor;
  const native = (method, options = {}) => cap.nativePromise('PDFapp', method, options);
  const listen = (event, cb) => cap.addListener('PDFapp', event, cb);

  const b64ToBytes = (b64) => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  const bytesToB64 = (bytes) => {
    let s = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  };
  const nameOf = (p) => String(p).split('/').pop();
  const errText = (e) => String(e?.message || e?.errorMessage || e).replace(/^Error: /, '');

  let info = { name: 'PDFapp', version: '' };
  const ready = native('info').then((r) => (info = r)).catch(() => {});

  // Files dropped onto the app (from Files in Split View): kept in memory.
  const memory = new Map();
  let memSeq = 0;
  let newSeq = 0;

  const api = {
    platform: 'ios',
    get username() {
      return info.name || 'PDFapp';
    },
    startupPath: async () => {
      await ready;
      const r = await native('launchPath').catch(() => null);
      return r?.path || null;
    },
    version: async () => {
      await ready;
      return info.version;
    },

    // ---- files
    getRecent: async () => (await native('recent')).items || [],
    removeRecent: (p) => native('removeRecent', { path: p }),
    openDialog: async () => (await native('pick', { multiple: true })).paths || [],
    readFile: async (p) => {
      if (p.startsWith('mem://')) return await memory.get(p);
      const r = await native('read', { path: p, remember: true }).catch((e) => {
        throw new Error(errText(e));
      });
      return b64ToBytes(r.data);
    },
    readBytes: async (p) => {
      if (p.startsWith('mem://')) return await memory.get(p);
      return b64ToBytes((await native('read', { path: p, remember: false })).data);
    },
    // Saving somewhere new: the destination is chosen when the file is written (the export sheet needs the file).
    saveDialog: async (suggested, kind) => `new://${++newSeq}/${nameOf(suggested || (kind === 'md' ? 'Notes.md' : 'Document.pdf')).replace(/[\\/]/g, '-')}`,
    // Returns the path written to (a new one after the export sheet), or null if the user cancelled.
    writeFile: async (p, bytes) => {
      const data = bytesToB64(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      if (p.startsWith('new://') || p.startsWith('mem://')) {
        const r = await native('exportFile', { name: nameOf(p), data });
        return r.path || null;
      }
      if (p.startsWith('zotero://')) throw new Error('This PDF was downloaded from Zotero and cannot be saved back. Use Save As to keep a copy.');
      const r = await native('write', { path: p, data }).catch((e) => {
        throw new Error(errText(e));
      });
      return r.path || p;
    },
    pathForFile: (file) => {
      const p = `mem://${++memSeq}/${file.name.replace(/[\\/]/g, '-')}`;
      memory.set(p, file.arrayBuffer().then((b) => new Uint8Array(b)));
      return p;
    },
    displayDir: (r) => r.folder || '',
    pickFolder: async () => null,

    // ---- the app's own dialogs and window
    confirm: async (message, buttons) => (await native('confirm', { message, buttons })).index,
    error: (message) => native('alert', { message }),
    setDirty: () => {},
    setTitle: () => {},
    forceClose: () => {},
    printPdf: (bytes, name) => native('print', { data: bytesToB64(bytes), name }),
    printPages: async () => ({ ok: false, reason: 'Use printPdf on the iPad' }),
    copyText: (text) => native('copyText', { text }),

    // ---- events
    onOpenPath: (cb) => listen('openPath', (e) => e?.path && cb(e.path)),
    onSaveAndClose: () => {},
    // The app is going to the background: iPad apps are expected to keep the user's work, so the app
    // saves what it can, then tells iOS it is done.
    onBackground: (cb) =>
      listen('background', async () => {
        try {
          await cb();
        } finally {
          native('backgroundDone').catch(() => {});
        }
      }),

    // ---- Zotero: the key stays in the iPad's keychain, inside the plugin
    zotero: {
      config: () => native('zoteroConfig'),
      connect: (key) => native('zoteroConnect', { key }).catch((e) => {
        throw new Error(errText(e));
      }),
      folders: () => native('zoteroConfig'),
      disconnect: () => native('zoteroDisconnect'),
      api: async (method, path, opts = {}) => {
        const r = await native('zoteroRequest', {
          method, path, query: opts.query || {}, headers: opts.headers || {},
          body: opts.body === undefined ? null : JSON.stringify(opts.body),
        });
        let data = r.text;
        try {
          data = r.text ? JSON.parse(r.text) : null;
        } catch {}
        return { status: r.status, version: r.version || null, total: r.total || null, offline: !!r.offline, error: r.error, data };
      },
      file: async (lib, attKey, data) => {
        const r = await native('zoteroDownload', { lib, key: attKey, filename: data?.filename || `${attKey}.pdf` }).catch((e) => {
          throw new Error(errText(e));
        });
        return { path: r.path, local: false };
      },
      keyForPath: async () => null,
    },
  };
  window.api = api;
  document.documentElement.classList.add('ios');

  // ------------------------------------------------------------------ touch
  // The app's own code is written for a mouse. On the iPad a tap already arrives as a click (and a
  // mousedown and mouseup), but a drag, a pinch and a long press do not, so they are translated here.
  const app = () => window.__pdfapp;
  const mouse = (type, t, x, y) => t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'mouseup' ? 0 : 1, view: window }));

  document.addEventListener('DOMContentLoaded', () => {
    // Dragging a text box, a comment or a text box's resize handle with a finger.
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !e.target.closest('.ann-text, .ann-note')) return;
      if (e.target.closest('.ann-text.editing .tb')) return; // typing in a text box: leave the caret alone
      e.preventDefault(); // no compatibility mouse events: the ones below stand in for them
      mouse('mousedown', e.target, e.clientX, e.clientY);
      const move = (ev) => ev.pointerId === e.pointerId && mouse('mousemove', window, ev.clientX, ev.clientY);
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        mouse('mouseup', window, ev.clientX, ev.clientY);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }, true);

    // A long press opens the menu a right-click opens on the Mac (pages, thumbnails, the grid, recent files).
    let press = null;
    let swallowClick = false;
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      // Text keeps the iPad's own selection; annotations are dragged instead (above).
      if (e.target.closest('.textLayer span, input, textarea, .tb, button, #selBubble, .ann-text, .ann-note')) return;
      const x = e.clientX;
      const y = e.clientY;
      const target = e.target;
      clearTimeout(press?.timer);
      press = { x, y, id: e.pointerId, timer: setTimeout(() => {
        press = null;
        swallowClick = 'held'; // the finger is still down: the tap its lift makes must not reach the menu
        target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2, view: window }));
      }, 520) };
    }, true);
    const endPress = (e) => {
      if (swallowClick === 'held' && (e.type === 'pointerup' || e.type === 'pointercancel')) {
        swallowClick = 'lifted';
        setTimeout(() => (swallowClick = false), 400);
      }
      if (press && (e.type !== 'pointermove' || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10)) {
        clearTimeout(press.timer);
        press = null;
      }
    };
    for (const t of ['pointermove', 'pointerup', 'pointercancel']) window.addEventListener(t, endPress, true);
    document.addEventListener('click', (e) => {
      if (swallowClick) {
        swallowClick = false;
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);

    // Pinch to zoom the document (Safari's gesture events), not the whole page.
    const viewer = document.getElementById('viewer');
    let start = null;
    viewer.addEventListener('gesturestart', (e) => {
      e.preventDefault();
      start = app()?.S.scale || 1;
    });
    viewer.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      const a = app();
      if (!a || !a.S.pdf || start == null) return;
      a.S.fitMode = null;
      a.setScale(start * e.scale, { x: e.clientX, y: e.clientY });
    });
    viewer.addEventListener('gestureend', (e) => {
      e.preventDefault();
      start = null;
    });
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    // Selected text on a page gets a small bar: Highlight, Copy.
    const bubble = document.createElement('div');
    bubble.id = 'selBubble';
    bubble.hidden = true;
    bubble.innerHTML = '<button data-b="hl">Highlight</button><button data-b="copy">Copy</button>';
    document.body.append(bubble);
    bubble.addEventListener('pointerdown', (e) => e.preventDefault()); // keep the selection while tapping
    bubble.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const sel = window.getSelection();
      if (b.dataset.b === 'hl') app()?.highlightSelection();
      else if (sel) {
        api.copyText(sel.toString());
        sel.removeAllRanges();
      }
      bubble.hidden = true;
    });
    let selTimer;
    document.addEventListener('selectionchange', () => {
      clearTimeout(selTimer);
      selTimer = setTimeout(() => {
        const sel = window.getSelection();
        const node = sel && sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
        const el = node && (node.nodeType === 1 ? node : node.parentElement);
        if (!sel || sel.isCollapsed || !el || !el.closest('#pages')) {
          bubble.hidden = true;
          return;
        }
        const r = sel.getRangeAt(0).getBoundingClientRect();
        bubble.hidden = false;
        const w = bubble.offsetWidth;
        const top = r.top - bubble.offsetHeight - 12;
        bubble.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
        bubble.style.top = `${top > 60 ? top : r.bottom + 12}px`;
      }, 250);
    });
    document.getElementById('viewer').addEventListener('scroll', () => (bubble.hidden = true), { passive: true });
  });
})();
