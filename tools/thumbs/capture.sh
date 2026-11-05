#!/bin/sh
# macOS twin of capture.ps1. Built-in wallpapers: capture.sh <id>... (from thumb-<id>.html).
# One page: capture.sh -Page <page.html> -Out <file.jpg>
set -u
here=$(cd "$(dirname "$0")" && pwd)
page='' out=''
while [ $# -gt 0 ]; do
  case $1 in
    -Page) page=$2; shift 2 ;;
    -Out) out=$2; shift 2 ;;
    *) break ;;
  esac
done
[ -n "$page" ] && rm -f "$out" # (first: no picture beats an old one of another scene)

browser=''
for b in "${THUMB_BROWSER:-}" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
  if [ -n "$b" ] && [ -x "$b" ]; then browser=$b; break; fi
done
[ -n "$browser" ] || { echo 'No Chromium browser found (Chrome, Edge, Brave or Chromium). Set THUMB_BROWSER to one.' >&2; exit 1; }

shoot() { # <page.html> <file.jpg>
  src=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
  jpg=$2 id=$(basename "$2" .jpg) png="${2%.jpg}.png"
  rm -f "$png"
  "$browser" --headless=new --disable-gpu --hide-scrollbars --window-size=1200,700 --virtual-time-budget=3000 \
    "--screenshot=$png" "file://$src" >/dev/null 2>&1
  [ -f "$png" ] || { echo "$id: no shot"; return; }
  sips -z 140 240 -s format jpeg -s formatOptions 78 "$png" --out "$jpg" >/dev/null && rm -f "$png"
  echo "$id: $(wc -c < "$jpg" | tr -d ' ') bytes"
}

if [ -n "$page" ]; then
  shoot "$page" "$out"
else
  for id in "$@"; do shoot "$here/thumb-$id.html" "$here/$id.jpg"; done
fi
