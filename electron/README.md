# Quarry Desktop (Electron shell)

Wraps the Quarry app (`../Quarry Analyst.dc.html`) in a desktop window and injects
each client's license token at launch. **The app HTML stays the single source of
truth** — this shell just hosts it.

> ⚠️ **This machine had no Node.js installed, so this scaffold was written but not
> run or packaged here.** The steps below are the standard Electron flow; expect to
> tune paths once you run it the first time.

## Prerequisites

- **Node.js 18+** (install from https://nodejs.org). This is the one thing missing
  on the current machine — Electron cannot run or build without it.

## Run in development

```bash
cd electron
npm install
npm start
```

This opens the app in a desktop window, loading `../Quarry Analyst.dc.html`.

## Give a window to a specific client (licensing)

1. Mint that client's token (from the repo root):
   ```bash
   python tools/quarry_license.py mint --client acme-dental --plan monthly --quota 100 --json
   ```
2. Save it as `electron/license.json`:
   ```json
   { "token": "<paste the token>" }
   ```
3. `npm start` — the sidebar shows the client name and `used / quota`.

Without a `license.json`, the app runs in **Trial — unlimited** mode (because
`QUARRY_LICENSE_REQUIRED = false` in the app). Flip that constant to `true` in
`../Quarry Analyst.dc.html` to hard-block usage without a valid license.

## Package installers

```bash
npm run build:win   # NSIS installer in electron/dist
npm run build:mac   # DMG (run on macOS)
```

For distribution you'll also want **code-signing** (Windows) and **notarization**
(macOS) — otherwise users hit "unknown publisher" warnings. See electron-builder docs.

## Still to do for a true offline build (privacy)

Right now the app pulls a few libraries from CDNs (React, sql.js, Chart.js,
PptxGenJS, SheetJS) — so a first launch needs internet. For a fully offline,
"nothing leaves your computer" build, **vendor those libraries locally**:

```bash
python ../tools/vendor_deps.py      # downloads them into ../vendor/
```

…then repoint the `<script src="https://…">` tags in `Quarry Analyst.dc.html`
(and `REACT_URL` in `support.js`) at the local `vendor/` copies. This is the last
step to make the desktop app work with no network at all.
