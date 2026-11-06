#!/usr/bin/env bash
set -euo pipefail

# Force an ASCII/IP host for Expo Dev Client to avoid Android TLS hostname parsing
# failures (IDN.toASCII) when machine names contain non-ASCII characters.

resolve_lan_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null && return 0
    ipconfig getifaddr en1 2>/dev/null && return 0
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig | awk '/inet / && $2 != "127.0.0.1" { print $2; exit }' && return 0
  fi

  return 1
}

PACKAGER_PORT="${EXPO_PACKAGER_PORT:-8081}"

# Pre-flight: kill any stale Metro/Expo processes holding our port.
# This is the #1 cause of "endpoint offline" — the simulator is pointed at a
# tunnel URL from a dead session while a zombie process keeps the port warm.
if command -v lsof >/dev/null 2>&1; then
  STALE_PIDS="$(lsof -tiTCP:"${PACKAGER_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${STALE_PIDS}" ]]; then
    echo "[start-dev-safe] Killing stale process(es) on port ${PACKAGER_PORT}: ${STALE_PIDS}"
    # shellcheck disable=SC2086
    kill ${STALE_PIDS} 2>/dev/null || true
    sleep 2
    # Force kill anything still hanging on
    STALE_PIDS="$(lsof -tiTCP:"${PACKAGER_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${STALE_PIDS}" ]]; then
      # shellcheck disable=SC2086
      kill -9 ${STALE_PIDS} 2>/dev/null || true
      sleep 1
    fi
  fi
fi

LAN_IP="$(resolve_lan_ip || true)"

if [[ -n "${LAN_IP}" ]]; then
  export REACT_NATIVE_PACKAGER_HOSTNAME="${LAN_IP}"
  export EXPO_DEVTOOLS_LISTEN_ADDRESS="0.0.0.0"
  echo "[start-dev-safe] Using LAN IP host: ${LAN_IP}"
  echo "[start-dev-safe] Simulator/dev client should connect to: http://${LAN_IP}:${PACKAGER_PORT}"
  exec npx expo start --dev-client --host lan --port "${PACKAGER_PORT}" --clear "$@"
fi

echo "[start-dev-safe] Could not resolve LAN IP; falling back to tunnel host."
exec npx expo start --dev-client --host tunnel --port "${PACKAGER_PORT}" --clear "$@"
