#!/usr/bin/env python3
"""Static checks for the NXE Deck CSS Loader theme.

1. theme.json: every injected/patched file exists, tabs are known names.
2. Every CSS class selector is known to CSS Loader's translation table
   (api.deckthemes.com/stable.json), so it will be rewritten to Steam's
   current hash. Unknown classes silently match nothing on the Deck.
3. If the Steam client is installed on this Mac, each translated hash exists
   in its gamepad UI code (same UI as the Deck; versions can drift).
4. No names from DENY, whose translation is known to hit the wrong element.

Usage: python3 tools/check_theme.py [--refresh] [--beta] [-v]
"""

import argparse
import json
import re
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THEME = ROOT / "NXE Deck"
CACHE = Path(__file__).resolve().parent / ".cache"
MAX_AGE = 24 * 3600

# Classes Steam adds without hashing, so they need no translation.
UNHASHED = {"gpfocus", "gpfocuswithin", "gpfocusable", "Focusable", "BasicUI",
            "ReactVirtualized__Grid__innerScrollContainer",
            "DialogButton", "Primary", "Destructive", "DialogSubHeader", "SettingsDialogSubHeader",  # Steam's shared dialog classes
            "DialogHeader", "DialogBodyText", "DialogFooter",
            # Steam's friends UI (older code, global names; read live from a Deck)
            "friendsui-container", "FriendsListAndChatsSteamDeck", "SteamDeckChats", "SteamDeckChatsHidden",
            "friendlist", "FriendsListTab", "Active", "friendGroup", "groupName", "groupCount", "friend",
            "chatHeader", "chatHistory"}

# Names that translate, but to the wrong element (reason shown on failure).
_MENU = "translates to the DashboardMenu module; the Steam-button menu renders another one. Use .mainmenu_Menu [role='menuitem']"
DENY = {n: _MENU for n in ("mainmenu_Item", "mainmenu_ItemOuter", "mainmenu_ItemLabel",
                           "mainmenu_ItemIcon", "mainmenu_Active", "mainmenu_ActiveDot")}
DENY["quickaccessmenu_TabContentColumn"] = "no longer used by the client"

STEAMUI = Path.home() / "Library/Application Support/Steam/Steam.AppBundle/Steam/Contents/MacOS/steamui"

# Tab names CSS Loader understands (css_inject.py DEFAULT_MAPPINGS + docs).
KNOWN_TABS = {
    "bigpicture", "bigpictureoverlay", "QuickAccess", "MainMenu", "SP",
    "Steam Big Picture Mode", "All", "desktop", "desktopchat", "desktoppopup",
    "desktopoverlay", "desktopcontextmenu", "store",
}

# Same token regex CSS Loader uses when translating (css_inject.py).
CLASS_RE = re.compile(r"\.([_a-zA-Z]+[_a-zA-Z0-9-]*)")


def load_mappings(refresh: bool, beta: bool) -> dict:
    name = "beta.json" if beta else "stable.json"
    path = CACHE / name
    if refresh or not path.exists() or time.time() - path.stat().st_mtime > MAX_AGE:
        CACHE.mkdir(exist_ok=True)
        url = f"https://api.deckthemes.com/{name}"
        req = urllib.request.Request(url, headers={"User-Agent": "nxe-deck-check"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                path.write_bytes(resp.read())
        except Exception as exc:  # offline: fall back to a stale cache if we have one
            if not path.exists():
                sys.exit(f"Could not fetch {url}: {exc}")
            print(f"warning: using cached {name} ({exc})")
    return json.loads(path.read_text(encoding="utf-8"))


def build_index(data: dict):
    """old name -> set of latest names; latest names -> True (mirrors CSS Loader)."""
    translate = defaultdict(set)
    latest = set()
    for versions in data.values():
        latest.add(versions[-1])
        for old in versions[:-1]:
            translate[old].add(versions[-1])
    return translate, latest


def strip_non_selectors(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", " ", css, flags=re.S)
    css = re.sub(r"url\([^)]*\)", " ", css)
    css = re.sub(r"'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"", " ", css)
    return css


def check_manifest() -> tuple[list[Path], list[str]]:
    errors = []
    manifest = json.loads((THEME / "theme.json").read_text(encoding="utf-8"))
    files = set()

    def visit(inject: dict, where: str):
        for key, tabs in inject.items():
            if key.startswith("--"):
                tabs = tabs[1:]
            else:
                files.add(key)
                if not (THEME / key).is_file():
                    errors.append(f"{where}: missing file {key}")
            for tab in tabs:
                if tab not in KNOWN_TABS:
                    errors.append(f"{where}: unknown tab '{tab}' for {key}")

    visit(manifest.get("inject", {}), "inject")
    for pname, patch in manifest.get("patches", {}).items():
        values = patch.get("values", {})
        if patch.get("type") == "checkbox" and set(values) != {"Yes", "No"}:
            errors.append(f"patch '{pname}': checkbox values must be exactly Yes/No")
        if patch.get("default") not in values:
            errors.append(f"patch '{pname}': default '{patch.get('default')}' is not a value")
        for vname, inject in values.items():
            visit(inject, f"patch '{pname}' / {vname}")
        for comp in patch.get("components", []):
            if comp.get("on") not in values:
                errors.append(f"patch '{pname}': component on='{comp.get('on')}' is not a value")
            if comp.get("type") not in ("color-picker", "image-picker"):
                errors.append(f"patch '{pname}': unknown component type '{comp.get('type')}'")
            # CSS Loader refuses to load the theme if an image-picker default is missing
            # (path is relative to ~/homebrew/themes, i.e. starts with the theme folder).
            if comp.get("type") == "image-picker" and not (ROOT / comp.get("default", "")).is_file():
                errors.append(f"patch '{pname}': image-picker default '{comp.get('default')}' does not exist")
            for tab in comp.get("tabs", []):
                if tab not in KNOWN_TABS:
                    errors.append(f"patch '{pname}': unknown component tab '{tab}'")

    return sorted(THEME / f for f in files), errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download the mapping")
    ap.add_argument("--beta", action="store_true", help="check against beta.json")
    ap.add_argument("-v", "--verbose", action="store_true", help="list every class")
    args = ap.parse_args()

    css_files, errors = check_manifest()
    translate, latest = build_index(load_mappings(args.refresh, args.beta))
    client_js = ""
    if STEAMUI.exists():
        client_js = "".join(p.read_text(encoding="utf-8", errors="ignore") for p in STEAMUI.glob("*.js"))

    unknown, ambiguous, denied, stale, ok = [], [], [], [], 0
    for path in css_files:
        rel = path.relative_to(THEME)
        # CSS Loader doubles every backslash on injection (css_inject.py escapes
        # after both translation passes), so CSS escapes like '\25CF' break.
        code = re.sub(r"/\*.*?\*/", " ", path.read_text(encoding="utf-8"), flags=re.S)
        if "\\" in code:
            errors.append(f"{rel}: contains a backslash; CSS Loader doubles it. Use the literal character instead")
        # :has() inside :has() is invalid; inside a forgiving :is() it is silently dropped.
        stack = []
        for i, ch in enumerate(code):
            if ch == "(":
                stack.append(code.endswith(":has", 0, i))
            elif ch == ")" and stack:
                stack.pop()
            if code.startswith(":has(", i) and any(stack):
                line = code.count("\n", 0, i) + 1
                errors.append(f"{rel}:{line}: :has() nested inside :has() is ignored by the browser")
                break
        classes = sorted(set(CLASS_RE.findall(strip_non_selectors(path.read_text(encoding="utf-8")))))
        for cls in classes:
            if cls in DENY:
                denied.append(f"{rel}: .{cls} {DENY[cls]}")
            if cls in UNHASHED or cls in latest:
                status = "current"
            elif cls in translate:
                targets = translate[cls]
                if len(targets) > 1:
                    ambiguous.append(f"{rel}: .{cls} -> {len(targets)} different classes")
                status = "-> " + sorted(targets)[0]
                if client_js and not any(f'"{t}"' in client_js for t in targets):
                    stale.append(f"{rel}: .{cls} -> {sorted(targets)[0]}")
            else:
                unknown.append(f"{rel}: .{cls}")
                status = "UNKNOWN"
            if status != "UNKNOWN":
                ok += 1
            if args.verbose:
                print(f"  {rel}: .{cls} {status}")

    for msg in errors:
        print(f"ERROR  {msg}")
    for msg in unknown:
        print(f"WARN   unknown class (won't translate) {msg}")
    for msg in ambiguous:
        print(f"WARN   ambiguous {msg}")
    for msg in denied:
        print(f"ERROR  denied {msg}")
    for msg in stale:
        print(f"WARN   not in local Steam client {msg}")
    client = "checked against local Steam client" if client_js else "local Steam client not found"
    print(f"\n{len(css_files)} CSS files, {ok} known classes, {len(unknown)} unknown, "
          f"{len(ambiguous)} ambiguous, {len(denied)} denied, {len(stale)} missing from client, "
          f"{len(errors)} manifest errors ({client})")
    return 1 if errors or unknown or denied else 0


if __name__ == "__main__":
    sys.exit(main())
