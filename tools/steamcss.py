#!/usr/bin/env python3
"""Print Steam's own CSS rules for gamepad-UI classes, with hashes turned back
into readable names. Reads the Steam client installed on this Mac, which ships
the same gamepad UI as the Deck (versions can lag each other; the Deck is the
final word).

Usage:
  python3 tools/steamcss.py mainmenu_Item           # rules mentioning this class
  python3 tools/steamcss.py 'quickaccessmenu_.*'    # regex over readable names
  python3 tools/steamcss.py --module gamepadslider  # everything in a module
  python3 tools/steamcss.py --js quickaccessmenu    # module's name->hash export in the JS
"""

import argparse
import glob
import json
import re
import sys
from pathlib import Path

STEAMUI = Path.home() / "Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamui"
MAPPING = Path(__file__).resolve().parent / ".cache" / "stable.json"


def load_names():
    """latest hash -> readable module_Name (shortest readable alias)."""
    data = json.loads(MAPPING.read_text(encoding="utf-8"))
    readable = {}
    for versions in data.values():
        aliases = [v for v in versions[:-1]
                   if "_" in v and not v.startswith("_") and not v.endswith("_")]
        if aliases:
            readable[versions[-1]] = min(aliases, key=len)
    return readable


def unminify(text, readable):
    return re.sub(r"\.([_a-zA-Z][_a-zA-Z0-9-]*)",
                  lambda m: "." + readable.get(m.group(1), m.group(1)), text)


def skip_string(css, j):
    """If css[j] opens a string, comment or escape, return the index just past it."""
    if css[j] == "\\":  # escaped char, e.g. Steam's `.KeyTheme_\{`
        return j + 2
    if css[j] in "\"'":
        q, j = css[j], j + 1
        while j < len(css) and css[j] != q:
            j += 2 if css[j] == "\\" else 1
        return j + 1
    if css.startswith("/*", j):
        end = css.find("*/", j + 2)
        return len(css) if end < 0 else end + 2
    return j


def iter_rules(css):
    """Yield top-level rules and rules nested one level in @media/@supports."""
    i, n = 0, len(css)
    while i < n:
        open_, j = -1, i
        while j < n:
            k = skip_string(css, j)
            if k != j:
                j = k
                continue
            if css[j] == "{":
                open_ = j
                break
            j += 1
        if open_ < 0:
            return
        head = css[i:open_].strip()
        depth, j = 1, open_ + 1
        while j < n and depth:
            k = skip_string(css, j)
            if k != j:
                j = k
                continue
            depth += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
        body = css[open_ + 1:j - 1]
        if head.startswith("@media") or head.startswith("@supports"):
            for sel, inner in iter_rules(body):
                yield f"{head} {{ {sel}", inner
        else:
            yield head, body
        i = j


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pattern", nargs="?", help="readable class name or regex")
    ap.add_argument("--module", help="show every rule touching this module")
    ap.add_argument("--js", metavar="MODULE", help="print the module's class export from the JS")
    args = ap.parse_args()

    if not STEAMUI.exists():
        sys.exit(f"Steam client not found at {STEAMUI}")
    readable = load_names()

    if args.js:
        hashes = {h: r for h, r in readable.items() if r.startswith(args.js + "_")}
        for path in glob.glob(str(STEAMUI / "*.js")):
            text = Path(path).read_text(encoding="utf-8", errors="ignore")
            for m in re.finditer(r"\{(?:[A-Za-z0-9_$\"'-]+:\"[_A-Za-z0-9-]+\",?){3,}\}", text):
                found = re.findall(r"\"([_A-Za-z0-9-]+)\"", m.group(0))
                if sum(h in hashes for h in found) >= 3:
                    print(f"{Path(path).name}: {unminify_js(m.group(0), readable)}\n")
        return

    pat = args.pattern or (args.module + "_.*")
    rx = re.compile(r"\." + pat + r"(?![A-Za-z0-9-])")
    css = "".join(Path(p).read_text(encoding="utf-8", errors="ignore")
                  for p in sorted(glob.glob(str(STEAMUI / "css" / "*.css")) + glob.glob(str(STEAMUI / "*.css"))))
    for sel, body in iter_rules(css):
        sel_r = unminify(sel, readable)
        if rx.search(sel_r):
            decls = ";\n  ".join(d.strip() for d in body.split(";") if d.strip())
            print(f"{sel_r} {{\n  {decls}\n}}\n")


def unminify_js(obj, readable):
    return re.sub(r"\"([_A-Za-z0-9-]+)\"", lambda m: '"' + readable.get(m.group(1), m.group(1)) + '"', obj)


if __name__ == "__main__":
    main()
