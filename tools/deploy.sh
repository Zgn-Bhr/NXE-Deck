#!/usr/bin/env bash
# Copy the theme to the Deck over SSH, after the static checks pass.
# Usage: DECK=deck@<deck-ip> tools/deploy.sh
# Then reload from CSS Loader's QAM panel (or enable its live CSS editing).
set -euo pipefail
: "${DECK:?Set DECK=deck@<deck-ip>}"
cd "$(dirname "$0")/.."

python3 tools/check_theme.py

# No --delete: CSS Loader keeps the user's patch choices in config_*.json inside the theme folder.
rsync -av --exclude '.DS_Store' "NXE Deck/" "$DECK:homebrew/themes/NXE\ Deck/"

# Case bands "By source": label this Deck's own Heroic / Retro / App shortcuts. The
# list is generated from the Deck's shortcuts.vdf into a temporary file and copied
# over the neutral options/sources.css on the Deck only, so the project (and the
# published theme) never holds anyone's shortcut IDs.
tmp=$(mktemp -t nxe-sources)
if python3 tools/gen_sources.py --out "$tmp"; then
  scp -q "$tmp" "$DECK:homebrew/themes/NXE Deck/options/sources.css"
else
  echo "gen_sources: skipped (could not read the Deck's shortcut list)"
fi
rm -f "$tmp"
