#!/usr/bin/env bash
# Schwanki dev stack: start/stop the local Supabase backend + web app.
#
#   ./start.sh           start backend if needed, then run the web app in the foreground
#   ./start.sh stop      stop the web app and the Supabase stack (data persists)
#   ./start.sh restart   stop, then start again
#
# Why the odd bits: this machine needs DOCKER_CONFIG to avoid a Docker credential-helper
# stall, and system pnpm (8.4.0) can't read the v9 lockfile — hence npx pnpm@9.15.0.
set -euo pipefail
cd "$(dirname "$0")"

export DOCKER_CONFIG="${DOCKER_CONFIG:-/tmp/docker-config-schwanki}"
mkdir -p "$DOCKER_CONFIG"

APP_URL=http://localhost:5173
API_URL=http://127.0.0.1:54321
STUDIO_URL=http://127.0.0.1:54323

up() { curl -s -o /dev/null --max-time 2 "$1" >/dev/null 2>&1; }

wait_for() { # $1 url  $2 label  $3 max attempts (x2s)
  local i=0
  while ! up "$1"; do
    i=$((i + 1))
    if [ "$i" -ge "$3" ]; then echo "✗ $2 never came up ($1)" >&2; exit 1; fi
    sleep 2
  done
  echo "✓ $2 up"
}

start_stack() {
  if up "$API_URL"; then
    echo "✓ Supabase stack already running"
  else
    echo "… starting Supabase stack (can take a minute or two)"
    supabase start
    wait_for "$API_URL" "Supabase stack" 90
  fi
}

stop_all() {
  echo "… stopping web app"
  # kill by port (pkill -f vite would hit other projects)
  local pids
  pids=$(lsof -ti tcp:5173 2>/dev/null || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
  echo "… stopping Supabase stack (data persists)"
  supabase stop
  echo "✓ stopped"
}

case "${1:-start}" in
  start)
    start_stack
    echo ""
    echo "  App:     $APP_URL"
    echo "  Studio:  $STUDIO_URL"
    if up "$APP_URL"; then
      echo "✓ web app already running — nothing to do"
    else
      echo "  (⌃C stops the web app; the stack keeps running — ./start.sh stop for both)"
      exec npx pnpm@9.15.0 dev
    fi
    ;;
  stop) stop_all ;;
  restart) stop_all; start_stack; exec npx pnpm@9.15.0 dev ;;
  *) echo "usage: $0 [start|stop|restart]" >&2; exit 1 ;;
esac
