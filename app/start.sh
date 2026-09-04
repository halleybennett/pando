#!/bin/bash
# Launches Pando: local web server + Chrome. Double-click in Finder, or run from Terminal.
set -e
cd "$(dirname "$0")"
PORT=8020
URL="http://localhost:$PORT"
if lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "Already running on $URL — opening Chrome."
  open -a "Google Chrome" "$URL"; exit 0
fi
echo "Starting Pando on $URL"
echo "Close this window to stop the server."
( sleep 0.8 && open -a "Google Chrome" "$URL" ) &
exec python3 serve.py "$PORT"
