#!/usr/bin/env bash
# Starts the Expo web frontend. Auth and data now come from Firebase, so there's
# no local API or database to run — see RUNNING.md for the one-time setup.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/.dev-logs"
mkdir -p "$LOG_DIR"

# Fails with a clear message if something we don't own is already bound to $1 (port).
check_port_free() {
  local port="$1" label="$2"
  local hit
  hit="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -n "$hit" ]; then
    echo "==> Port $port ($label) is already in use by another process:" >&2
    ps -o pid,command -p $hit >&2
    echo "    Stop it first (or run ./dev-down.sh if it's a previous run of this script), then retry." >&2
    exit 1
  fi
}

echo "==> Firebase config"
if [ ! -f "$ROOT_DIR/frontend/.env" ]; then
  echo "    frontend/.env is missing — copy frontend/.env.example and fill it in." >&2
  exit 1
fi
missing=""
for key in EXPO_PUBLIC_FIREBASE_API_KEY EXPO_PUBLIC_FIREBASE_PROJECT_ID \
           EXPO_PUBLIC_FIREBASE_APP_ID EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET; do
  grep -qE "^${key}=.+" "$ROOT_DIR/frontend/.env" || missing="$missing $key"
done
if [ -n "$missing" ]; then
  echo "    frontend/.env is incomplete — empty:$missing" >&2
  exit 1
fi
echo "    ok"

echo "==> Frontend (yarn web on :1101)"
check_port_free 1101 frontend
(cd "$ROOT_DIR/frontend" && nohup yarn web --port 1101 > "$LOG_DIR/frontend.log" 2>&1 &)
echo "    starting — Metro takes a few seconds to bundle, watch $LOG_DIR/frontend.log"

cat <<EOF

Frontend  http://localhost:1101   (log: $LOG_DIR/frontend.log)

Stop it with: ./dev-down.sh
EOF
