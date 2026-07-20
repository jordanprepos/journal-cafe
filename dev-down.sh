#!/usr/bin/env bash
# Stops the frontend, backend, and MongoDB started by dev-up.sh.
# Process matches are scoped to this repo's absolute paths so this can't
# accidentally kill an unrelated checkout/worktree running the same stack.
set +e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Frontend"
if pkill -f "$ROOT_DIR/frontend/node_modules/.bin/expo start --web" 2>/dev/null; then
  echo "    stopped"
else
  echo "    not running"
fi

echo "==> Backend"
if pkill -f "$ROOT_DIR/backend/venv/bin/uvicorn" 2>/dev/null; then
  echo "    stopped"
else
  echo "    not running"
fi

echo "==> MongoDB (journal-mongo)"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx journal-mongo; then
  docker stop journal-mongo >/dev/null
  echo "    stopped"
else
  echo "    not running"
fi
