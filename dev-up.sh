#!/usr/bin/env bash
# Starts MongoDB (Docker), the FastAPI backend, and the Expo web frontend together.
# See RUNNING.md for the manual/one-time setup steps this assumes are already done.
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

echo "==> Docker daemon"
if ! docker info >/dev/null 2>&1; then
  echo "    not running — launching Docker Desktop"
  open -a Docker
  for i in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null 2>&1 || { echo "    Docker daemon didn't come up in time" >&2; exit 1; }
fi
echo "    up"

echo "==> MongoDB (journal-mongo)"
if docker ps --format '{{.Names}}' | grep -qx journal-mongo; then
  echo "    already running"
elif docker ps -a --format '{{.Names}}' | grep -qx journal-mongo; then
  check_port_free 27017 mongo
  docker start journal-mongo >/dev/null
  echo "    started"
else
  echo "    container doesn't exist yet — creating it"
  check_port_free 27017 mongo
  docker run -d --name journal-mongo -p 27017:27017 mongo:7 >/dev/null
fi
echo "    up on :27017"

echo "==> Backend (uvicorn on :8001)"
check_port_free 8001 backend
(cd "$ROOT_DIR/backend" && nohup "$ROOT_DIR/backend/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > "$LOG_DIR/backend.log" 2>&1 &)

printf "    waiting for health check"
ok=0
for i in $(seq 1 30); do
  if curl -sf http://localhost:8001/api/ >/dev/null 2>&1; then
    ok=1
    break
  fi
  printf "."
  sleep 1
done
echo ""
if [ "$ok" -ne 1 ]; then
  echo "    backend failed to come up — see $LOG_DIR/backend.log" >&2
  exit 1
fi
echo "    up — $(curl -s http://localhost:8001/api/)"

echo "==> Frontend (yarn web on :8081)"
check_port_free 8081 frontend
(cd "$ROOT_DIR/frontend" && nohup yarn web > "$LOG_DIR/frontend.log" 2>&1 &)
echo "    starting — Metro takes a few seconds to bundle, watch $LOG_DIR/frontend.log"

cat <<EOF

All services launched:
  MongoDB   localhost:27017
  Backend   http://localhost:8001   (log: $LOG_DIR/backend.log)
  Frontend  http://localhost:8081   (log: $LOG_DIR/frontend.log)

Stop everything with: ./dev-down.sh
EOF
