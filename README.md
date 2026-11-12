# PDFacil

This is a Windows PDF viewer designed for researchers who read papers in PDF format.
The Home menu on top has all the tools one needs:

(fácil: 'easy', in Spanish)

![The PDFacil Home menu](images/menu_screenshot.png)


## Installation (Windows only)

1. Download the zip file from https://urisohn.com/sohn_files/software/PDFacil.zip
2. Unzip it
3. No install, just use it running `PDFacil.exe`

You can also build it from source, see next.


### If you want to build from source 

You need [Node.js](https://nodejs.org/) 20 or newer.

```
git clone <this repository>
cd PDFacil
npm install       # installs dependencies and copies the PDF libraries into src/vendor
npm start         # runs the app for development
npm run dist      # builds the Windows app into dist/win-unpacked
```

The finished app is the `dist/win-unpacked` folder; run `PDFacil.exe` inside it. To have `npm run dist` also copy the app to another folder, set the `PDFACIL_OUT` environment variable to that folder first. Close PDFacil before rebuilding, or Windows will keep the old files locked.

## macOS (this fork)

This fork adds a macOS build. The app is not signed with an Apple Developer ID, so macOS will warn the first time it is opened.

**Download a build:** on GitHub, open *Actions* › *Build macOS app*, pick the latest run and download the `PDFacil-mac` artifact (a `.dmg` and a `.zip`; a universal app for Apple silicon and Intel). To start a build by hand, use *Run workflow* there.

**Or build it on your Mac:** with [Node.js](https://nodejs.org/) 20 or newer,

```
npm install
npm start           # run it without building
npm run dist:mac    # builds dist/PDFacil-<version>-universal.dmg and .zip
```

**First launch:** drag PDFacil to Applications, then right-click it and choose *Open*. If macOS says it is damaged, run
`xattr -dr com.apple.quarantine /Applications/PDFacil.app` in Terminal. To make it the default PDF viewer, select a PDF in Finder, *Get Info* › *Open with* › PDFacil › *Change All*.

On the Mac, shortcuts use ⌘ in place of Ctrl, redo is ⌘⇧Z, ⌘-click picks several thumbnails, and ⌘⇧R hides or shows the ribbon.

## How it was made

PDFacil was designed by Uri Simonsohn and written with Claude Opus 5.5 (Anthropic's AI model). 
Version 1.0.0 was developed in November, 2026

It is built on open-source components:

- [Electron](https://www.electronjs.org/) for the desktop app
- [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla) for displaying, searching and printing PDFs
- [pdf-lib](https://pdf-lib.js.org/) for saving edits into the PDF



## License

PDFacil is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): you may share and adapt it for non-commercial purposes, with credit to the author. Commercial use is not permitted.

The components it builds on have their own open-source licenses: Electron (MIT), PDF.js (Apache 2.0) and pdf-lib (MIT).
