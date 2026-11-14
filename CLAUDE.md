# PDFapp

A PDF viewer and editor for researchers, based on Uri Simonsohn's PDFacil: a Mac app (Electron, `main.js`) and an iPad and iPhone app (Capacitor, `ios/`), both from the code in `src/`. `APPS.md` in the private repository BDStanley/PL-data is the guide to all of Ben's apps and how they are installed, renewed and published.

## Rules

- **With every change that reaches main: raise the version and add a changelog entry.** The last number for a fix, the middle one for a new feature or a visible change (the first only for a complete rework). The version is `version` in `package.json` (the source: the Mac app and its About box read it) and `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`, on both of the App target's lines, which the iPad and iPhone About box reads. Keep them the same. Write the entry at the top of `CHANGELOG.md`, in plain British English for Ben, not commit-speak. Never commit a change without both.
- British English throughout. Never put keys or tokens in files.
- The renewal scripts (`scripts/update.sh`, `scripts/ipad-renew-setup.sh`, `scripts/ipad-renew.sh`) are parallel copies of those in PL-data and To-read: change all three repositories together.
- Run `npm test` (under `xvfb-run -a` on Linux) before pushing.
- Commit messages end with the attribution lines the session provides.
