# Quarry

A privacy-first AI data analyst. Open your business data (SQLite, CSV, Excel, JSON),
ask questions in plain English, get audited tables + charts you can export to
PowerPoint / Word. The data stays on the machine; only the LLM (cloud or offline)
sees query results.

## Project layout

The app is **authored in small source files** under `src/` and **assembled** into the
single `Quarry Analyst.dc.html` that the dc-runtime (`support.js`) renders. Edit the
sources, then run the build — never hand-edit the generated `.dc.html`.

```
src/
  app.head.html        <!doctype> + <helmet> (library <script> tags + styles)
  app.template.html    the UI markup (dc {{ }} template)
  app.scripttag.html   the <script data-dc-script data-props="..."> open tag
  app.tail.html        </script></body></html>
  js/                  the logic — a chain of classes, one concern per file:
    00-base.js         QBase  (state, lifecycle, mount)
    10-license.js      QLicense  (offline license verify, quota, usage)
    20-ingest.js       QIngest   (CSV / TSV / JSON / Excel / SQL / SQLite import)
    30-data.js         QData     (sql.js init, schema, queries)
    40-viz.js          QViz      (charts + PNG/Word/PowerPoint export)
    50-model.js        QModel    (chat turn, tools, Anthropic/OpenAI calls)
    90-render.js       Component (the render bindings)  <-- final class in the chain

build.py               assembles src/ -> Quarry Analyst.dc.html
support.js             the dc-runtime (vendored; don't edit)
data/                  sample database
tools/
  quarry_license.py    mint/keygen license tokens (ECDSA P-256)
  vendor_deps.py       download front-end libs locally for a fully offline build
electron/              desktop shell (needs Node.js installed; see electron/README.md)
build/keys/            the license SIGNING key — gitignored, keep secret
business/              business plan + sales deck
build/LICENSING-AND-OPS-PANEL.md   licensing & client-ops design
```

The class chain (`QBase → QLicense → … → Component`) works because the runtime
evaluates the script and returns whatever `Component` is — so each file is a normal
class body, and inheritance flattens every method onto the final `Component`.

## Build & run

```bash
python build.py                      # assemble src/ -> Quarry Analyst.dc.html
python -m http.server 8123           # then open http://localhost:8123/Quarry%20Analyst.dc.html
```

(A dev server config is in `.claude/launch.json`.) The desktop build is in `electron/`.

## Licensing (per client)

```bash
python tools/quarry_license.py keygen          # once — creates the signing key, prints the public key
python tools/quarry_license.py mint --client acme-dental --plan monthly --quota 100 --json
```

The public key is embedded in the app (`QUARRY_LICENSE_PUBKEY` in `src/js/10-license.js`).
Give a client their token via `window.QUARRY_LICENSE` (Electron injects it from
`license.json`) or `localStorage['quarry_license']`. Trial mode (unlimited) runs when
no token is present; set `QUARRY_LICENSE_REQUIRED = true` in `src/js/10-license.js` to
hard-block usage without a valid license.

> Note: `Quarry Analyst (standalone).html` is a legacy compiled bundle from before the
> refactor and is **out of date** — the source of truth is `src/` + `build.py`.
