#!/usr/bin/env bash
# Build dist/NXE-Deck-<version>.zip with the "NXE Deck" folder at its root,
# ready to extract into ~/homebrew/themes/ on the Deck (or submit to DeckThemes).
set -euo pipefail
cd "$(dirname "$0")/.."

python3 tools/check_theme.py
python3 tools/gen_depth.py >/dev/null
python3 tools/gen_scroll.py >/dev/null

version=$(python3 -c "import json; print(json.load(open('NXE Deck/theme.json'))['version'])")
mkdir -p dist
out="dist/NXE-Deck-${version}.zip"
rm -f "$out"
zip -rq "$out" "NXE Deck" -x '*.DS_Store' -x 'NXE Deck/config_*.json'
unzip -l "$out"
echo "wrote $out"
