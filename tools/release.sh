#!/bin/bash
# Stamp the build, commit, push. The stamp in app.js is what tells you - and Halley on her
# phone - which version is actually running; a hand-edited one goes stale silently and then
# lies, which is worse than not having it.
#
#   ./tools/release.sh "commit message"
set -e
cd "$(dirname "$0")/.."
[ -z "$1" ] && { echo "usage: ./tools/release.sh \"commit message\""; exit 1; }

STAMP=$(date '+%Y-%m-%d %H:%M')
perl -pi -e "s/var BUILD = '[^']*';/var BUILD = '$STAMP';/" app/app.js
echo "stamped $STAMP"

python3 tools/a11y-audit.py > /dev/null || { echo "accessibility audit FAILED - not pushing"; exit 1; }
echo "accessibility audit passed"

git add -A
git commit -q -m "$1"
git push -q origin main
echo "pushed. Pages usually takes about 40s."
