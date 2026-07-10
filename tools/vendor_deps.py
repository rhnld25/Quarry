#!/usr/bin/env python3
"""
Download Quarry's front-end libraries into ./vendor/ so the app can run fully
offline (privacy: nothing leaves the machine). After running, repoint the
<script src="https://..."> tags in "Quarry Analyst.dc.html" and REACT_URL /
REACT_DOM_URL in support.js at the local vendor/ copies.

Usage:  python tools/vendor_deps.py
"""
import os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, "vendor")

DEPS = {
    "react.production.min.js":   "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
    "react-dom.production.min.js":"https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
    "sql-wasm.min.js":           "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.min.js",
    "sql-wasm.wasm":             "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm",
    "chart.umd.min.js":          "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
    "pptxgen.bundle.js":         "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
    "xlsx.full.min.js":          "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
}


def main():
    os.makedirs(VENDOR, exist_ok=True)
    for name, url in DEPS.items():
        dest = os.path.join(VENDOR, name)
        try:
            print(f"↓ {name} ... ", end="", flush=True)
            with urllib.request.urlopen(url, timeout=60) as r, open(dest, "wb") as f:
                f.write(r.read())
            print(f"{os.path.getsize(dest):,} bytes")
        except Exception as e:
            print(f"FAILED ({e})")
            sys.exit(1)
    print(f"\nVendored into {VENDOR}")
    print("Next: repoint the CDN <script> tags in 'Quarry Analyst.dc.html' and")
    print("REACT_URL/REACT_DOM_URL in support.js at ./vendor/ (drop the integrity attrs).")
    print("For sql.js, set initSqlJs locateFile to 'vendor/' so it finds sql-wasm.wasm.")


if __name__ == "__main__":
    main()
