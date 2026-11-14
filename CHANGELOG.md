# Changelog

PDFapp's versions, newest first. The version is shown in the About box (File tab › About, or F1) on the Mac and on the iPad and iPhone. With every change: raise the version (the last number for a fix, the middle one for a new feature or a visible change) in `package.json` and the Xcode project, and add an entry here (see CLAUDE.md).

## 1.5.0 — 13 November 2026
- The weekly renewal renews the iPhone as well as the iPad, and the set-up never picks one of Xcode's simulators as the device to renew.
- Your signing team is kept out of the Xcode project (in `ios/signing.xcconfig`), so updating never fails with "Your local changes would be overwritten"; `npm run update` updates and opens Xcode in one go.
- A trial of a different way of selecting text was withdrawn; selection works as in 1.4.1.

## 1.4.1 — 12 November 2026
- Highlighting no longer freezes on large selections, and text selection behaves as it did before 12 November.
- Clicking Highlight with text selected highlights it.
- iPhone: the Highlight and Copy bar works even when iOS clears the selection as you tap it.

## 1.4.0 — 12 November 2026
- The app runs on the iPhone too, with a layout for the phone.
- A full-screen mode that also hides the iPad's and iPhone's status bar.

## 1.3.0 — 12 November 2026
- The iPad app, with the same features as the Mac app, saving to files anywhere in Files.
- The ribbon fits on narrow screens, such as an iPad held upright.
- The iPad app can be renewed automatically from the Mac.

## 1.2.0 — 12 November 2026
- The app is renamed PDFapp.
- The Page Grid: every page as a thumbnail in the main window, for picking, extracting, rotating and deleting pages.

## 1.1.0 — 12 November 2026
- A Mac version, one app for Apple silicon and Intel Macs, with a new icon.
- Extract Pages saves selected pages as a new PDF; Merge PDFs joins several PDFs into one.
- Copy Notes and Save Notes turn highlights and comments into Markdown notes.
- Zotero: open PDFs from your Zotero library, with highlights, comments and text boxes kept in step with Zotero's annotations.
- The look of benstanley.eu: Jost and the site's colours.

## 1.0.0
- Uri Simonsohn's PDFacil, the Windows app this one is based on, as it was when Ben took it up.
