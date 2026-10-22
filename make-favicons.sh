#!/bin/sh
# Makes favicons from logo.png using macOS's built-in "sips" tool.
# Run from this folder:  sh make-favicons.sh
set -e
[ -f logo.png ] || { echo "Put logo.png in this folder first."; exit 1; }
sips -z 32 32 logo.png --out favicon-32.png >/dev/null
sips -z 180 180 logo.png --out apple-touch-icon.png >/dev/null
echo "Made favicon-32.png and apple-touch-icon.png"
