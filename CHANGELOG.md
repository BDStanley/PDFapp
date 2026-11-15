# Changelog

PDFapp's versions, newest first. The version is shown in the About box (File tab › About, or F1) on the Mac and on the iPad and iPhone. With every change: raise the version (the last number for a fix, the middle one for a new feature or a visible change) in `package.json` and the Xcode project, and add an entry here (see CLAUDE.md).

## 1.5.6 — 15 November 2026
- Opening PDFapp in Xcode no longer changes the project file. Xcode had no signing team for its Release settings, so it wrote yours into the project, and that one-line change then stopped the commit script (and could block pulling the next update). Release now reads the team from `ios/signing.xcconfig`, as Debug always has, through a new `ios/release.xcconfig`.
- No change to the app itself.

## 1.5.5 — 15 November 2026
- The notification after installing on the iPad and iPhone no longer says PDFapp is "good for another 7 days". That was true when the app was signed with a free Apple ID; with the paid developer team an install lasts a year. The install script now reads the real date from the app it has just built ("signed until 15 November 2027") and says that in its log and its notification.
- When Updater installs the app, the script sends no notification of its own, because Updater already says how the update went. Run by hand (`bash scripts/ipad-renew.sh`), it still notifies you, including when something fails.
- No change to the app itself.

## 1.5.4 — 15 November 2026
- The update and renewal scripts (`scripts/update.sh`, `scripts/ipad-renew.sh`) install the packages with `npm ci`, which uses exactly the versions in `package-lock.json` and never rewrites it. Running them no longer leaves a changed lock file that blocks syncing between Macs. No change to the app itself.

## 1.5.3 — 15 November 2026
- Tidied the dependency lock file (npm's bookkeeping only). No change to the app itself.

## 1.5.2 — 15 November 2026
- Xcode's package cache (`xcshareddata/swiftpm/`) is now ignored by git, so it no longer shows as a pending change. No change to the app itself.

## 1.5.1 — 14 November 2026
- The README clones the app into `~/Apps/PDF reader`, its folder name on the Mac from 14 November 2026.

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
