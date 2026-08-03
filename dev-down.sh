#!/usr/bin/env bash
# Stops the frontend started by dev-up.sh.
# The process match is scoped to this repo's absolute path so this can't
# accidentally kill an unrelated checkout/worktree running the same stack.
set +e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Frontend"
if pkill -f "$ROOT_DIR/frontend/node_modules/.bin/expo start --web" 2>/dev/null; then
  echo "    stopped"
else
  echo "    not running"
fi
