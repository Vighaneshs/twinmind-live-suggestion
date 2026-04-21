#!/usr/bin/env bash
# Run both back-end and front-end dev servers. Ctrl+C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK="$ROOT/back-end"
FRONT="$ROOT/front-end"

if [[ ! -d "$BACK/node_modules" ]]; then
  echo "[setup] installing back-end deps…"
  (cd "$BACK" && npm install)
fi
if [[ ! -d "$FRONT/node_modules" ]]; then
  echo "[setup] installing front-end deps…"
  (cd "$FRONT" && npm install)
fi

prefix() {
  local label="$1"
  while IFS= read -r line; do
    printf '[%s] %s\n' "$label" "$line"
  done
}

pids=()
cleanup() {
  echo
  echo "[dev] stopping…"
  for pid in "${pids[@]:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd "$BACK" && npm run dev) 2>&1 | prefix "back " &
pids+=($!)

(cd "$FRONT" && npm run dev) 2>&1 | prefix "front" &
pids+=($!)

echo "[dev] back-end pid=${pids[0]}  front-end pid=${pids[1]}"
echo "[dev] front-end: http://localhost:5173   back-end: http://localhost:8080"
echo "[dev] Ctrl+C to stop both."
wait
