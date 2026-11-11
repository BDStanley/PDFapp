# PDFacil

An easy PDF viewer and editor for Windows, with a Word-style ribbon.

## Run
Double-click `PDFacil-1.0.0-portable.exe` (kept in C:/dropbox/Programs, not in this repo). No installation needed.
Tip: right-click any PDF > Open with > Choose another app > browse to the exe, to open PDFs with PDFacil.

## Ribbon
- **File**: Open, Save, Save As, Print, Recent, Close
- **Pages**: First/Previous/Next/Last, Go to page, Rotate left/right, Delete page
- **Comment**: Select, Highlight, Text, Comment (sticky note), colors, font size, Remove
- **View**: Zoom in/out, 100%, Fit width, Fit page, Search, Thumbnails

## Shortcuts
| Keys | Action |
|---|---|
| Ctrl+O / Ctrl+S / Ctrl+Shift+S | Open / Save / Save As |
| Ctrl+P | Print |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+F, F3 | Search, next match |
| Ctrl+G | Go to page |
| Ctrl + mouse wheel, Ctrl +/-, Ctrl+0 | Zoom, 100% |
| V / H / T / N | Select / Highlight / Text / Comment tool |
| Delete | Remove selected highlight, text or comment (or selected pages in the thumbnail bar) |
| Esc | Finish editing, back to Select |

Highlights, text boxes and comments are saved as standard PDF annotations, so Acrobat, Edge and Chrome show them. Reopening a file in PDFacil makes them editable again.

## Build from source
Requires Node.js 20 or newer.
```
npm install               # also copies pdf.js / pdf-lib into src/vendor
npm start                 # run in development
npm run dist              # build the exe in dist/, then copy it to C:/dropbox/Programs
```
To copy the exe somewhere else, set `PDFACIL_OUT` first, e.g. `set PDFACIL_OUT=D:\apps` (cmd).
The exe is never stored in git (see `.gitignore`).
