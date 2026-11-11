# PDFacil

An easy PDF viewer and editor for Windows, with a Word-style ribbon.

## Run
Run `PDFacil.exe` in `C:/program files (by claude)/PDFacil` (the whole folder is the app; it is not stored in this repo). No installation needed, and it starts in about a second.
Tip: right-click any PDF > Open with > Choose another app > browse to the exe, to open PDFs with PDFacil.

## Ribbon
- **Home** (opens first): Open, Save, Print, Delete page, Rotate left/right, Select, Highlight, Text, Comment, Outline, Thumbnails
- **File**: Open, Save, Save As, Print, Recent, Close
- **Pages**: First/Previous/Next/Last, Go to page, Rotate left/right, Delete page
- **Comment**: Select, Highlight, Text, Comment (sticky note), colors, font, font size, Remove
- **View**: Zoom in/out, 100%, Fit width, Fit page, Search, Outline, Thumbnails
- **Outline**: a clickable table of contents on the left. Uses the PDF's bookmarks; if it has none, headings are detected from the text size. The current section is highlighted as you scroll
- **Text formatting**: right-click a text box you typed to change its font (Arial, Times New Roman, Courier New), size and color
- **Hide the ribbon**: the arrow at the top right (or Ctrl+F1, or double-click a tab) collapses the ribbon for more reading space; click a tab to use it temporarily
- **Tabs**: open several PDFs at once; each gets a tab (Ctrl+Tab to switch, Ctrl+W or middle-click to close)
- **About** (File tab or F1): designed by Uri Simonsohn, created with Claude Opus 5.5 (High), November 11, 2026

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
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous file tab |
| Ctrl+W | Close current tab |
| Ctrl+F1 | Hide / show the ribbon |
| F1 | About PDFacil |

Highlights, text boxes and comments are saved as standard PDF annotations, so Acrobat, Edge and Chrome show them. Reopening a file in PDFacil makes them editable again.

## Build from source
Requires Node.js 20 or newer.
```
npm install               # also copies pdf.js / pdf-lib into src/vendor
npm start                 # run in development
npm run dist              # build dist/win-unpacked, then copy it to C:/program files (by claude)/PDFacil
```
Close PDFacil before `npm run dist` so the old files are not locked. To copy the app somewhere else, set `PDFACIL_OUT` first, e.g. `set PDFACIL_OUT=D:\apps` (cmd).
The built app is never stored in git (see `.gitignore`).
