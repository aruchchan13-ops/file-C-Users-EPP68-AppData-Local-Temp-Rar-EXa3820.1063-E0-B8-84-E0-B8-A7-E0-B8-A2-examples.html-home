#!/usr/bin/env bash
# Wraps app/kru-board.html (the artifact page body) in a full HTML document as index.html,
# so the same app can also be opened directly or hosted (e.g. GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n'
  cat app/kru-board.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "built index.html"
