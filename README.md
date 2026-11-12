# PDFacil

This is a Windows PDF viewer designed for researchers who read papers in PDF format.
The Home menu on top has all the tools one needs:

(fácil: 'easy', in Spanish)

![The PDFacil Home menu](images/menu_screenshot.png)


## Installation (Windows only)

1. Download the zip file
2. Unzip it
3. Run `PDFacil.exe`



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
