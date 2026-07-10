#!/usr/bin/env python3
"""
Assemble the Quarry app from its source pieces in src/ into the single
`Quarry Analyst.dc.html` that the dc-runtime (support.js) renders.

Why a build step? The runtime parses one file: the `<x-dc>` template plus the
inline `<script data-dc-script>`. So we author in small files and stitch them:

  src/app.head.html        <!doctype> ... <helmet> (deps + styles)
  src/app.template.html     the UI markup (the {{ }} template)
  src/app.scripttag.html    the <script data-dc-script data-props="..."> open tag
  src/js/*.js               the logic, as a chain of classes:
                              00-base (QBase extends DCLogic) -> ... ->
                              90-render (class Component extends QModel)
  src/app.tail.html         </script></body></html>

Run:  python build.py
"""
import glob, io, os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
OUT = os.path.join(ROOT, "Quarry Analyst.dc.html")


def read(p):
    return io.open(p, encoding="utf-8").read()


def main():
    head = read(os.path.join(SRC, "app.head.html"))
    template = read(os.path.join(SRC, "app.template.html"))
    scripttag = read(os.path.join(SRC, "app.scripttag.html"))
    tail = read(os.path.join(SRC, "app.tail.html"))

    modules = sorted(glob.glob(os.path.join(SRC, "js", "*.js")))
    if not modules:
        raise SystemExit("No JS modules found in src/js/")
    js = "\n\n".join(read(m).rstrip("\n") for m in modules)

    out = head + template + scripttag + "\n" + js + "\n" + tail
    io.open(OUT, "w", encoding="utf-8", newline="").write(out)

    print(f"Built {os.path.basename(OUT)}  ({len(out):,} bytes)")
    print("  modules:", ", ".join(os.path.basename(m) for m in modules))


if __name__ == "__main__":
    main()
