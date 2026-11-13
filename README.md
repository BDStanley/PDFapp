# PDFapp

A PDF viewer and editor for researchers who read papers in PDF format, for macOS, the iPad and Windows. The Home menu along the top has all the tools you need.

PDFapp is based on Uri Simonsohn's [PDFacil](https://github.com/urisohn/PDFacil), a Windows app, and was further developed by Ben Stanley. Its additions:

- **a macOS version**, built as one app for Apple silicon and Intel Macs;
- **an iPad version**, with the same features, saving to files anywhere in Files;
- **Extract Pages**, which saves selected pages as a new PDF;
- **Merge PDFs**, which joins several PDFs into one;
- **the Page Grid**, which shows every page as a thumbnail in the main window for picking pages;
- **Copy Notes** and **Save Notes**, which turn highlights and comments into Markdown notes;
- **Zotero integration**: open PDFs from your Zotero library, with highlights, comments and text boxes saved as Zotero annotations that sync to Zotero on every device;
- **a new name, icon and look**: the type (Jost) and colours of benstanley.eu.


## What it does

- Open several PDFs at once, each in its own tab, with thumbnails and the document's outline in the sidebar.
- Highlight text, add comments, and type text onto the page. All of these are saved into the PDF as standard annotations, so other PDF readers show them.
- Search, zoom, and go to a page.
- Rotate and delete pages, with undo and redo.
- **Page Grid** (*View* or *Pages* tab, or Ctrl+Shift+G, ⌘⇧G on a Mac): every page as a thumbnail in the main window. Ways to pick pages:
  - click a page to select it;
  - Ctrl-click (⌘-click on a Mac), or click the circle in a page's corner, to add pages;
  - Shift-click to select a run of pages;
  - drag a box across the gaps between pages to select a block;
  - Ctrl+A (⌘A) to select every page.

  The bar at the top shows what is selected, and *Extract selected…* saves those pages as a new PDF. Right-click for rotating, deleting or extracting, or press Delete to delete. Double-click a page, or press Enter, to read it; Escape closes the grid. A slider sets the size of the thumbnails, and journal page numbers are shown beside the PDF's own where the PDF has them.
- **Extract Pages** (*Pages* tab): saves the selected pages as a new PDF, picked in the Page Grid or in the side thumbnails (Ctrl- or ⌘-click to add, Shift-click for a run). You can also right-click a thumbnail and choose *Extract … as a new PDF*. With no pages selected, it extracts the current page. The new file includes your unsaved highlights, comments and rotations. The original file is left as it is.
- **Merge PDFs** (*Pages* or *File* tab, and works with no document open): joins PDFs in an order you set in a dialog. *Add files…* adds PDFs, the arrows change the order, and ✕ removes a file. The open document starts the list, with its unsaved edits, and can be removed too.
- **Copy Notes** and **Save Notes** (*Comment* tab): turn every highlight, comment and text box in the document into Markdown notes. *Copy Notes* copies them for pasting into any notes app, Word or an email; *Save Notes* saves a `.md` file next to the PDF.
  - Notes are grouped by page, top to bottom, under the page numbers printed in the journal where the PDF has them (for example "Page 245 (PDF page 3)").
  - Each highlight is quoted, followed by any comment on it. Highlight colours are named when the document uses more than one.
  - The title comes from the PDF's own metadata where it has a sensible one, otherwise from the file name.

Highlights made in PDFapp keep the exact text you selected. For highlights made in other apps, such as Preview, Acrobat or Zotero, the text is worked out from where the highlight sits on the page, in whole words; occasionally a word at the edge of such a highlight is cut short.

Both extracting and merging ask where to save the new file, then open it in a new tab. Bookmarks (the outline) are not copied into the new file, and password-protected PDFs cannot be extracted from or merged.


## Zotero

PDFapp can open the PDFs in your Zotero library and save your highlights, comments and text boxes as **Zotero annotations**: the same kind Zotero's own reader makes. They sync through Zotero, so they appear in Zotero on your computer, in the web library and in the Zotero iPad and iPhone apps. Annotations made in Zotero appear in PDFapp too.

**Connecting (once).**

1. Create an API key at [zotero.org/settings/keys/new](https://www.zotero.org/settings/keys/new). Tick *Allow library access* and *Allow write access*, and give it access to your groups if you want them.
2. In PDFapp, click *Zotero* on the *Home* tab, paste the key and click *Save*. PDFapp keeps the key in your computer's keychain.
3. Check the *Zotero data folder* (normally `~/Zotero`). PDFapp opens PDFs from its `storage` folder where it can, and downloads them from Zotero otherwise. If you keep PDFs as linked files, also set the *Linked files folder* to the base directory set in Zotero.

**Opening papers.** Click *Zotero* to browse your library: pick a library and collection, or search by title, author or year. Then select a paper and its PDF, and click *Open*.

You can also set PDFapp as Zotero's PDF reader: in Zotero, choose *Settings › General › File Handling › Open PDFs using* and pick PDFapp. A PDF opened from Zotero's storage folder is linked to Zotero automatically.

**While you read.** The status bar shows the Zotero link. Each change is sent to Zotero a moment after you make it, so there is nothing to save. Changes made elsewhere are fetched when you open the paper and whenever you come back to PDFapp.

If the connection drops, PDFapp keeps trying, and it will not close the paper without asking while changes are still unsent. When the same annotation has been changed both in PDFapp and elsewhere, the change made in PDFapp is kept. Zotero on your computer picks up the changes at its next sync; click its sync button to see them straight away.

**Good to know.**

- **Deleting pages:** pages cannot be deleted from a Zotero PDF, because Zotero places annotations by page. Use *Extract Pages* to make a copy without them. Rotating pages works, and *Save* writes the rotation into the PDF in Zotero's storage folder.
- **Older annotations in the file:** annotations already written into the PDF file (by PDFapp before it was linked, or by another app) stay in the file. Zotero shows them as imported annotations.
- **Unsupported Zotero annotations:** Zotero's drawings and image annotations are kept in Zotero but not shown in PDFapp, and underlines are shown as highlights.
- **Notes and copies:** *Copy Notes*, *Save Notes*, *Extract Pages* and *Merge PDFs* include the Zotero annotations. *Save As* makes a copy outside Zotero with all the annotations written into the PDF.
- **Downloaded PDFs:** PDFapp cannot save changes to the file itself (such as rotation) back to Zotero. The annotations still sync.


## Installing on a Mac

The app is not signed with an Apple Developer ID, so macOS warns you the first time you open it.

**Download a build.** On this repository's GitHub page, open *Actions* › *Build macOS app*, pick the latest successful run and download the `PDFapp-mac` artifact. It contains a `.dmg` and a `.zip`. To start a build yourself, click *Run workflow* on the same page.

**Or build it yourself.** You need [Node.js](https://nodejs.org/) 20 or newer:

```
git clone https://github.com/BDStanley/PDFapp.git
cd PDFapp
npm install         # installs dependencies and copies the PDF libraries into src/vendor
npm start           # runs the app without building it
npm run dist:mac    # builds dist/PDFapp-<version>-universal.dmg and .zip
```

**First launch.** Open the `.dmg`, drag PDFapp to Applications, then right-click the app and choose *Open*. If macOS says the app is damaged, run this in Terminal:

```
xattr -dr com.apple.quarantine /Applications/PDFapp.app
```

To make PDFapp your default PDF viewer, select any PDF in Finder and choose *Get Info* › *Open with* › PDFapp › *Change All*.

**Coming from PDFacil.** The first time PDFapp opens, it brings over the recent files and the Zotero folder settings from the older PDFacil app. Paste your Zotero API key in once more: it is kept in the keychain under the app's name. Annotations saved with PDFacil open in PDFapp as before. The old `PDFacil.app` can be deleted.

**Keyboard.** On a Mac, shortcuts use ⌘ where Windows uses Ctrl. Redo is ⌘⇧Z, ⌘-click picks several thumbnails, ⌘⇧G opens the Page Grid, and ⌘⇧R hides or shows the ribbon (Ctrl+F1 on Windows).


## On the iPad

PDFapp runs on the iPad too, with the same features. The app is the same code as on the Mac, wrapped with [Capacitor](https://capacitorjs.com/) (`ios/`, `ios-web/`), with a small native plugin for files, printing and Zotero (`ios/App/App/PDFappPlugin.swift`).

**How it differs from the Mac.**

- **Opening:** *Open* shows the Files sheet: pick PDFs anywhere, in iCloud Drive or on the iPad. In Files, you can also choose *Share › PDFapp*, or open a PDF in PDFapp, and it opens there.
- **Saving:** *Save* writes back to the same file; PDFapp remembers its permission to each file you have opened. *Save As*, *Extract Pages*, *Merge PDFs* and *Save Notes* ask where to put the new file in the Files sheet.
- **When you leave the app:** the iPad may close an app in the background at any time, so PDFapp saves open documents when you switch away from it. A new document that has never been saved stays open with its changes.
- **Touch:**
  - select text by pressing on it, then tap *Highlight* or *Copy* on the bar above the selection;
  - pinch to zoom;
  - press and hold for the menus that a right-click opens on the Mac (pages, thumbnails, the Page Grid);
  - drag comments and text boxes with a finger;
  - in the Page Grid, tap the circles to pick pages.

  With a keyboard attached, the ⌘ shortcuts work as on the Mac.
- **Full screen:** the corner button in the top bar, or *View › Full Screen*, hides every bar and panel, and the iPad's status bar, so the pages fill the screen. The button in the top-right corner, Escape or ⌘⇧F brings them back. (It works on the Mac too, inside the window.)
- **On the iPhone** the same app has a compact layout: the ribbon is one strip of small buttons that scrolls sideways, thumbnails start hidden, and the outline opens over the page. The layout also applies to a narrow iPad window (Slide Over).
- **Printing** uses the iPad's own print sheet. *Copy Notes* uses the iPad's clipboard.
- **Zotero** works as on the Mac. The key is kept in the iPad's keychain, and PDFs come from Zotero's own file storage (not WebDAV or linked files, which are on your computer).

**Installing it with a free Apple ID.** An app installed with a free Apple ID works for 7 days and then has to be installed again. There are two ways.

*From Xcode*, with the iPad on a cable. You need Xcode from the Mac App Store.

1. In the PDFapp folder:
   ```
   git pull
   npm install
   npm run ios:open
   ```
   This builds the web part and opens the project in Xcode.
2. In Xcode, go to *Settings › Accounts*, click *+*, and add your Apple ID.
3. Click the *App* project, then the *App* target, then *Signing & Capabilities*, and set *Team* to your name (Personal Team).
   Then run `bash scripts/update.sh`: it moves the team out of the project file into `ios/signing.xcconfig` (ignored by git), which the project reads, and undoes Xcode's edit, so updates never clash with it. From then on, `npm run update` pulls, installs and opens Xcode in one go.
4. Connect the iPad and choose it at the top of the window. The first time:
   - on the iPad, turn on *Settings › Privacy & Security › Developer Mode* and restart it;
   - after the first install, trust your Apple ID on the iPad, under *Settings › General › VPN & Device Management*.
5. Click ▶ (Run). To renew the app after 7 days, click ▶ again.

*With AltStore*, which renews the app over Wi-Fi by itself:

1. Get the app file:
   - **download it:** under *Actions › Build iPad app* on this repository's GitHub page, download `PDFapp-ipad` from the latest successful run;
   - **or build it:** run `npm run ios:ipa` in the PDFapp folder, which makes `dist/PDFapp.ipa`.
2. Send `PDFapp.ipa` to the iPad with AirDrop or iCloud Drive.
3. In AltStore, open *My Apps*, tap *+*, and pick the file.

A free Apple ID allows three apps at a time through AltStore, AltStore itself included.

**Renewing it automatically** (no AltStore needed). Your Mac can rebuild PDFapp and reinstall it on the iPad over Wi-Fi twice a week, so the 7 days never run out. It fetches the latest version of PDFapp each time.

1. Run PDFapp on the iPad once from Xcode, as above, with your Personal Team chosen. Xcode then knows the iPad.
2. In the PDFapp folder, run:
   ```
   bash scripts/ipad-renew-setup.sh
   ```
   This records your team and your iPad and iPhone (whichever Xcode is paired with) in `~/.config/pdfapp/ipad.conf`; run it again after adding a device and schedules the renewal for Monday and Thursday at 20:07. If the Mac is asleep then, macOS runs it when it wakes.
3. To try it at once, run `bash scripts/ipad-renew.sh`.

Each renewal ends with a Mac notification saying whether it worked, and the details are in `~/Library/Logs/PDFapp-renew.log`. It needs the Mac logged in and the devices on the same Wi-Fi; if one cannot be reached, the other is still renewed. To switch it off, run `bash scripts/ipad-renew-setup.sh --remove`.

## Installing on Windows

To build PDFapp for Windows, you need [Node.js](https://nodejs.org/) 20 or newer:

```
git clone https://github.com/BDStanley/PDFapp.git
cd PDFapp
npm install
npm run dist        # builds the Windows app into dist/win-unpacked
```

Run `PDFapp.exe` inside `dist/win-unpacked`. To have `npm run dist` also copy the app to another folder, set the `PDFAPP_OUT` environment variable to that folder first. Close PDFapp before rebuilding, or Windows will keep the old files locked.


## Tests

The tests in `test/` drive the app with [Playwright](https://playwright.dev/), for example `node test/smoke.cjs`:

- `test/combine.cjs`: extracting and merging;
- `test/grid.cjs`: the Page Grid;
- `test/notes.cjs`: the notes;
- `test/zotero.cjs`: the Zotero integration, against a stand-in for Zotero's web API (`test/zotero-mock.cjs`);
- `test/rename-compat.cjs`: that annotations saved under the old name still open;
- `test/ribbon-fit.cjs`: that every ribbon tab fits on an iPad in portrait and landscape;
- `test/ios-web.cjs`: the iPad app's web part at iPad size, with touch, against a stand-in for the native plugin. The native plugin itself is only built and run in Xcode.


## Credits

PDFapp is based on PDFacil, designed by Uri Simonsohn and written with Claude Opus 5.5 (Anthropic's AI model) in November 2026.

PDFapp was further developed by Ben Stanley in November 2026, also with Claude: the macOS and iPad versions, Extract Pages, Merge PDFs, the Page Grid, the notes export, the Zotero integration, and the new name, icon and look.

It is built on open-source components:

- [Electron](https://www.electronjs.org/) for the desktop app
- [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla) for displaying, searching and printing PDFs
- [pdf-lib](https://pdf-lib.js.org/) for saving edits into the PDF, and for extracting and merging pages
- [Capacitor](https://capacitorjs.com/) for the iPad app


## Licence

PDFacil, and so PDFapp, is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): you may share and adapt it for non-commercial purposes, with credit to the author, Uri Simonsohn. Commercial use is not permitted. PDFapp is an adaptation of PDFacil under that licence. The changes are the ones listed under Credits.

The components it builds on have their own open-source licences: Electron (MIT), PDF.js (Apache 2.0), pdf-lib (MIT) and Capacitor (MIT). The Jost typeface (by indestructible type*) is under the SIL Open Font License 1.1, included as `src/fonts/OFL.txt`.
