#!/bin/bash
# Opens the Pando design docs (paper-options, icon-options, design kit...).
# These need a server because paper-options.html runs the real app in a frame,
# and the app cannot fetch its city data over file://. Double-click in Finder.
set -e
cd "$(dirname "$0")"
PORT=8021
URL="http://localhost:$PORT/paper-options.html"
if lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "Already running — opening Chrome."
  open -a "Google Chrome" "$URL"; exit 0
fi
echo "Pando docs on http://localhost:$PORT"
echo "Close this window to stop the server."
( sleep 0.8 && open -a "Google Chrome" "$URL" ) &
exec python3 serve.py "$PORT"
